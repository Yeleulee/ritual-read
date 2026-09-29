export interface YouTubeSearchResult {
  id: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
}

const YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";
const SUPABASE_EDGE_URL = (import.meta.env.VITE_SUPABASE_FUNCTIONS_URL as string | undefined) || "";

export async function searchYouTube(query: string): Promise<YouTubeSearchResult[]> {
  // Prefer server-side proxy, but fall back gracefully to client API key
  if (SUPABASE_EDGE_URL) {
    try {
      const base = SUPABASE_EDGE_URL.replace(/\/$/, "");
      const response = await fetch(`${base}/youtube-search?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        const items = (data?.items ?? []) as any[];
        return items.map((item) => ({
          id: item?.id?.videoId,
          title: item?.snippet?.title,
          channelTitle: item?.snippet?.channelTitle,
          thumbnailUrl: item?.snippet?.thumbnails?.medium?.url || item?.snippet?.thumbnails?.default?.url,
        })).filter((r) => !!r.id);
      }
      // If proxy responds with error, fall through to client key path
    } catch {
      // Network or other failure – fall through to client key path
    }
  }

  const key = (import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined)
    || (import.meta.env.NEXT_PUBLIC_YOUTUBE_API_KEY as string | undefined);
  if (!key) throw new Error("YouTube search not configured: missing VITE_YOUTUBE_API_KEY.");
  const params = new URLSearchParams({
    part: "snippet",
    q: query,
    type: "video",
    maxResults: "10",
    key,
    safeSearch: "none",
    relevanceLanguage: "en",
  });

  const response = await fetch(`${YOUTUBE_SEARCH_URL}?${params.toString()}`);
  if (!response.ok) {
    try {
      const err = await response.json();
      // Surface helpful API error messages
      const msg = err?.error?.message || `YouTube API error (${response.status})`;
      throw new Error(msg);
    } catch {
      throw new Error(`YouTube API error (${response.status})`);
    }
  }
  const data = await response.json();
  const items = (data?.items ?? []) as any[];
  return items.map((item) => ({
    id: item?.id?.videoId,
    title: item?.snippet?.title,
    channelTitle: item?.snippet?.channelTitle,
    thumbnailUrl: item?.snippet?.thumbnails?.medium?.url || item?.snippet?.thumbnails?.default?.url,
  })).filter((r) => !!r.id);
}


