import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DEV_AUTH_BYPASS, useAuth } from "@/hooks/use-auth";
import { DEFAULT_SETTINGS, type ReaderSettings } from "@/lib/reader-themes";

/* Local-first store. Every hook keeps state in localStorage immediately and, when a
   real Supabase user exists, mirrors it to the reader tables with a debounce.
   Newer `updated_at` wins when hydrating. */

const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);

function readLocal<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function writeLocal(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode */
  }
}

function useDebouncedCallback<A extends unknown[]>(fn: (...args: A) => void, ms: number) {
  const timer = useRef<number>();
  const latest = useRef(fn);
  latest.current = fn;
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return useCallback(
    (...args: A) => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => latest.current(...args), ms);
    },
    [ms],
  );
}

function useCloudUser(bookId?: string) {
  const { user } = useAuth();
  const cloud = !!user && !DEV_AUTH_BYPASS && (bookId === undefined || isUuid(bookId));
  return { user, cloud };
}

/* ---------- Settings ---------- */

const SETTINGS_KEY = "rr:settings";
type Stored<T> = { value: T; updated_at: string };

export function useReaderSettings() {
  const { user, cloud } = useCloudUser();
  const [state, setState] = useState<Stored<ReaderSettings>>(() => {
    const local = readLocal<Stored<ReaderSettings>>(SETTINGS_KEY);
    return local ? { ...local, value: { ...DEFAULT_SETTINGS, ...local.value } } : { value: DEFAULT_SETTINGS, updated_at: new Date(0).toISOString() };
  });

  useEffect(() => {
    if (!cloud) return;
    let cancelled = false;
    supabase
      .from("reader_settings")
      .select("settings, updated_at")
      .eq("user_id", user!.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        setState((cur) => {
          if (new Date(data.updated_at) <= new Date(cur.updated_at)) return cur;
          const next = { value: { ...DEFAULT_SETTINGS, ...(data.settings as Partial<ReaderSettings>) }, updated_at: data.updated_at };
          writeLocal(SETTINGS_KEY, next);
          return next;
        });
      });
    return () => {
      cancelled = true;
    };
  }, [cloud, user?.id]);

  const push = useDebouncedCallback((s: Stored<ReaderSettings>) => {
    if (!cloud) return;
    supabase.from("reader_settings").upsert({ user_id: user!.id, settings: s.value, updated_at: s.updated_at }).then(() => {});
  }, 800);

  const update = useCallback(
    (patch: Partial<ReaderSettings> | ((cur: ReaderSettings) => Partial<ReaderSettings>)) => {
      setState((cur) => {
        const p = typeof patch === "function" ? patch(cur.value) : patch;
        const next = { value: { ...cur.value, ...p }, updated_at: new Date().toISOString() };
        writeLocal(SETTINGS_KEY, next);
        push(next);
        return next;
      });
    },
    [push],
  );

  return { settings: state.value, update };
}

/* ---------- Reading position ---------- */

export type ReadingPosition = { location: string; percent: number; updated_at: string };

export function useReadingPosition(bookId: string) {
  const { user, cloud } = useCloudUser(bookId);
  const key = `rr:pos:${bookId}`;
  const [position, setPosition] = useState<ReadingPosition | null>(() => readLocal<ReadingPosition>(key));
  const [hydrated, setHydrated] = useState(!cloud);

  useEffect(() => {
    setPosition(readLocal<ReadingPosition>(key));
    if (!cloud) {
      setHydrated(true);
      return;
    }
    setHydrated(false);
    let cancelled = false;
    supabase
      .from("reading_positions")
      .select("location, percent, updated_at")
      .eq("user_id", user!.id)
      .eq("book_id", bookId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        if (data) {
          setPosition((cur) => {
            if (cur && new Date(cur.updated_at) >= new Date(data.updated_at)) return cur;
            const next = { location: data.location, percent: Number(data.percent), updated_at: data.updated_at };
            writeLocal(key, next);
            return next;
          });
        }
        setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, [bookId, cloud, user?.id, key]);

  const push = useDebouncedCallback((p: ReadingPosition) => {
    if (!cloud) return;
    supabase
      .from("reading_positions")
      .upsert({ user_id: user!.id, book_id: bookId, location: p.location, percent: p.percent, updated_at: p.updated_at })
      .then(() => {});
  }, 1500);

  const save = useCallback(
    (location: string, percent: number) => {
      const next = { location, percent: Math.min(1, Math.max(0, percent)), updated_at: new Date().toISOString() };
      setPosition(next);
      writeLocal(key, next);
      push(next);
    },
    [key, push],
  );

  return { position, hydrated, save };
}

/* ---------- Bookmarks ---------- */

export type Bookmark = { id: string; location: string; label?: string | null; excerpt?: string | null; created_at: string };

const newId = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);

export function useBookmarks(bookId: string) {
  const { user, cloud } = useCloudUser(bookId);
  const key = `rr:bm:${bookId}`;
  const [items, setItems] = useState<Bookmark[]>(() => readLocal<Bookmark[]>(key) ?? []);

  useEffect(() => {
    setItems(readLocal<Bookmark[]>(key) ?? []);
    if (!cloud) return;
    let cancelled = false;
    supabase
      .from("bookmarks")
      .select("id, location, label, excerpt, created_at")
      .eq("user_id", user!.id)
      .eq("book_id", bookId)
      .order("created_at")
      .then(({ data }) => {
        if (cancelled || !data) return;
        // Server is the source of truth for lists; local copies are just a cache.
        setItems(data);
        writeLocal(key, data);
      });
    return () => {
      cancelled = true;
    };
  }, [bookId, cloud, user?.id, key]);

  const persist = (next: Bookmark[]) => {
    setItems(next);
    writeLocal(key, next);
  };

  const add = useCallback(
    (location: string, excerpt?: string, label?: string) => {
      const bm: Bookmark = { id: newId(), location, label: label ?? null, excerpt: excerpt ?? null, created_at: new Date().toISOString() };
      persist([...items, bm]);
      if (cloud) supabase.from("bookmarks").insert({ ...bm, user_id: user!.id, book_id: bookId }).then(() => {});
      return bm;
    },
    [items, cloud, user?.id, bookId, key],
  );

  const remove = useCallback(
    (id: string) => {
      persist(items.filter((b) => b.id !== id));
      if (cloud) supabase.from("bookmarks").delete().eq("id", id).then(() => {});
    },
    [items, cloud, key],
  );

  const byLocation = useMemo(() => new Map(items.map((b) => [b.location, b])), [items]);

  return { bookmarks: items, add, remove, byLocation };
}

/* ---------- Highlights ---------- */

export type HighlightColor = "yellow" | "green" | "blue" | "pink" | "purple" | "underline";
export type Highlight = {
  id: string;
  cfi_range: string;
  text: string;
  color: HighlightColor;
  note?: string | null;
  created_at: string;
  updated_at: string;
};

export function useHighlights(bookId: string) {
  const { user, cloud } = useCloudUser(bookId);
  const key = `rr:hl:${bookId}`;
  const [items, setItems] = useState<Highlight[]>(() => readLocal<Highlight[]>(key) ?? []);

  useEffect(() => {
    setItems(readLocal<Highlight[]>(key) ?? []);
    if (!cloud) return;
    let cancelled = false;
    supabase
      .from("highlights")
      .select("id, cfi_range, text, color, note, created_at, updated_at")
      .eq("user_id", user!.id)
      .eq("book_id", bookId)
      .order("created_at")
      .then(({ data }) => {
        if (cancelled || !data) return;
        setItems(data as Highlight[]);
        writeLocal(key, data);
      });
    return () => {
      cancelled = true;
    };
  }, [bookId, cloud, user?.id, key]);

  const persist = (next: Highlight[]) => {
    setItems(next);
    writeLocal(key, next);
  };

  const add = useCallback(
    (cfiRange: string, text: string, color: HighlightColor, note?: string) => {
      const now = new Date().toISOString();
      const hl: Highlight = { id: newId(), cfi_range: cfiRange, text, color, note: note ?? null, created_at: now, updated_at: now };
      persist([...items, hl]);
      if (cloud) supabase.from("highlights").insert({ ...hl, user_id: user!.id, book_id: bookId }).then(() => {});
      return hl;
    },
    [items, cloud, user?.id, bookId, key],
  );

  const update = useCallback(
    (id: string, patch: Partial<Pick<Highlight, "color" | "note">>) => {
      const updated_at = new Date().toISOString();
      persist(items.map((h) => (h.id === id ? { ...h, ...patch, updated_at } : h)));
      if (cloud) supabase.from("highlights").update({ ...patch, updated_at }).eq("id", id).then(() => {});
    },
    [items, cloud, key],
  );

  const remove = useCallback(
    (id: string) => {
      persist(items.filter((h) => h.id !== id));
      if (cloud) supabase.from("highlights").delete().eq("id", id).then(() => {});
    },
    [items, cloud, key],
  );

  return { highlights: items, add, update, remove };
}
