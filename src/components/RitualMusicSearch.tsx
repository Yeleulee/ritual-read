import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { searchYouTube } from "@/lib/youtube";
import { getCurrentTrack, useMusicPlayer } from "@/hooks/use-music-player";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

const PRESETS = [
  { name: "Focus", query: "focus music for reading" },
  { name: "Calm", query: "ambient meditation music" },
  { name: "Rain", query: "rain sounds for sleeping and reading" },
  { name: "Piano", query: "quiet piano instrumental" },
  { name: "Lo-fi", query: "lofi hip hop radio study" },
];

export const RitualMusicSearch = () => {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<string>(PRESETS[0].name);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState("");
  const { playTrack, isPlaying } = useMusicPlayer();
  const current = useMusicPlayer(getCurrentTrack);

  const doSearch = async (q?: string, preset?: string) => {
    const search = (q ?? query).trim();
    if (!search) return;
    setActive(preset ?? "");
    setLoading(true);
    setError("");
    try {
      const items = await searchYouTube(search);
      setResults(items);
      if (items.length === 0) setError("No results. Try a different query.");
    } catch (e: any) {
      setResults([]);
      // Never echo raw upstream text; keys or internals must not reach the UI
      setError(String(e?.message || "Search failed.").replace(/AIza[\w-]+/g, "[redacted]"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    doSearch(PRESETS[0].query, PRESETS[0].name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      {/* Presets */}
      <div className="grid grid-cols-5 border-b border-border divide-x divide-border">
        {PRESETS.map((p) => (
          <button
            key={p.name}
            type="button"
            onClick={() => doSearch(p.query, p.name)}
            aria-pressed={active === p.name}
            className={cn(
              "h-10 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors",
              active === p.name ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground hover:bg-muted",
            )}
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* Search */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          doSearch();
        }}
        className="flex items-center gap-3 border-b border-border px-6 py-3"
      >
        <Input
          placeholder="Search — brown noise, alpha waves, a composer…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search music"
          className="h-9 border-0 px-0 focus-visible:border-0"
        />
        <Button type="submit" size="sm" variant="outline" disabled={loading || !query.trim()}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
        </Button>
      </form>

      {/* Results */}
      <div className="max-h-[320px] overflow-y-auto">
        {error && <p className="px-6 py-4 text-xs text-destructive">{error}</p>}

        {loading && (
          <ul aria-hidden className="divide-y divide-border">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="flex items-center gap-4 px-6 py-3">
                <div className="h-10 w-14 bg-muted animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-3/4 bg-muted animate-pulse" />
                  <div className="h-2 w-1/3 bg-muted animate-pulse" />
                </div>
              </li>
            ))}
          </ul>
        )}

        {!loading && results.length > 0 && (
          <ol className="divide-y divide-border">
            {results.map((r, i) => {
              const isCurrent = current?.id === r.id;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => playTrack({ id: r.id, title: r.title, channelTitle: r.channelTitle, thumbnailUrl: r.thumbnailUrl }, false)}
                    className={cn(
                      "group flex w-full items-center gap-4 px-6 py-3 text-left transition-colors hover:bg-muted/60",
                      isCurrent && "bg-muted/60",
                    )}
                  >
                    <span className="w-5 shrink-0 font-mono text-[11px] text-muted-foreground tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                    <img src={r.thumbnailUrl} alt="" className="h-10 w-14 shrink-0 border border-border object-cover" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{r.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">{r.channelTitle}</span>
                    </span>
                    <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground group-hover:text-foreground">
                      {isCurrent ? (isPlaying ? "Playing" : "Paused") : "Play"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <p className="border-t border-border px-6 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        Streams via YouTube · Audio only · Keeps playing while you read
      </p>
    </div>
  );
};
