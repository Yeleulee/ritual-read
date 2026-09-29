import { supabase } from "@/integrations/supabase/client";

export interface YouTubeSearchResult {
  id: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
}

interface YouTubeItem {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    channelTitle?: string;
    thumbnails?: { medium?: { url?: string }; default?: { url?: string } };
  };
}

interface YouTubeResponse {
  items?: YouTubeItem[];
  error?: { message?: string } | string;
}

const YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || "";
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || "";
// Server-side proxy keeps the YouTube key out of the bundle; defaults to the project's functions endpoint
const FUNCTIONS_URL =
  (import.meta.env.VITE_SUPABASE_FUNCTIONS_URL as string | undefined)?.replace(/\/$/, "") ||
  (SUPABASE_URL ? `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1` : "");
// Optional client-side fallback (public in the bundle — only use a referrer-restricted key)
const CLIENT_KEY = (import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined) || "";

function toResults(data: YouTubeResponse): YouTubeSearchResult[] {
  return (data.items ?? [])
    .map((item) => ({
      id: item.id?.videoId ?? "",
      title: item.snippet?.title ?? "",
      channelTitle: item.snippet?.channelTitle ?? "",
      thumbnailUrl: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || "",
    }))
    .filter((r) => !!r.id);
}

function errorMessage(data: YouTubeResponse | undefined, status: number): string {
  const err = data?.error;
  if (typeof err === "string") return err;
  return err?.message || `YouTube search failed (${status})`;
}

async function searchViaProxy(query: string): Promise<YouTubeSearchResult[]> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || SUPABASE_ANON_KEY;
  const response = await fetch(`${FUNCTIONS_URL}/youtube-search?q=${encodeURIComponent(query)}`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  const data = (await response.json().catch(() => undefined)) as YouTubeResponse | undefined;
  if (!response.ok || !data || data.error) throw new Error(errorMessage(data, response.status));
  return toResults(data);
}

async function searchViaClientKey(query: string): Promise<YouTubeSearchResult[]> {
  const params = new URLSearchParams({
    part: "snippet",
    q: query,
    type: "video",
    maxResults: "10",
    key: CLIENT_KEY,
    safeSearch: "none",
    relevanceLanguage: "en",
  });
  const response = await fetch(`${YOUTUBE_SEARCH_URL}?${params.toString()}`);
  const data = (await response.json().catch(() => undefined)) as YouTubeResponse | undefined;
  if (!response.ok || !data || data.error) throw new Error(errorMessage(data, response.status));
  return toResults(data);
}

export async function searchYouTube(query: string): Promise<YouTubeSearchResult[]> {
  if (FUNCTIONS_URL && SUPABASE_ANON_KEY) {
    try {
      return await searchViaProxy(query);
    } catch (e) {
      if (!CLIENT_KEY) throw e;
    }
  }
  if (!CLIENT_KEY) {
    throw new Error("YouTube search is not configured. Set VITE_SUPABASE_URL (server proxy) or VITE_YOUTUBE_API_KEY.");
  }
  return searchViaClientKey(query);
}


