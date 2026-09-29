export interface YouTubeSearchResult {
  id: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
}

// Search always goes through the youtube-search edge function so the API key never
// reaches the browser. Defaults to the project's functions endpoint.
const FUNCTIONS_URL = (
  (import.meta.env.VITE_SUPABASE_FUNCTIONS_URL as string | undefined) ||
  (import.meta.env.VITE_SUPABASE_URL ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1` : "")
).replace(/\/$/, "");
const ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || "";

// Defensive: strip anything that looks like a Google API key from text shown to users
const scrub = (s: string) => s.replace(/AIza[\w-]+/g, "[redacted]");

export async function searchYouTube(query: string): Promise<YouTubeSearchResult[]> {
  if (!FUNCTIONS_URL) throw new Error("Music search is not configured.");

  let response: Response;
  try {
    response = await fetch(`${FUNCTIONS_URL}/youtube-search?q=${encodeURIComponent(query)}`, {
      headers: ANON_KEY ? { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } : {},
    });
  } catch {
    throw new Error("Couldn't reach music search. Check your connection.");
  }

  let data: any = null;
  try {
    data = await response.json();
  } catch { /* fall through to status handling */ }

  if (!response.ok) {
    const msg = typeof data?.error === "string" ? scrub(data.error) : "";
    throw new Error(msg || (response.status === 429 ? "Music search quota reached. Try again later." : "Music search failed. Try again later."));
  }

  const items = (data?.items ?? []) as any[];
  return items
    .map((item) => ({
      id: item?.id ?? item?.id?.videoId,
      title: item?.title ?? item?.snippet?.title,
      channelTitle: item?.channelTitle ?? item?.snippet?.channelTitle,
      thumbnailUrl: item?.thumbnailUrl ?? item?.snippet?.thumbnails?.medium?.url ?? item?.snippet?.thumbnails?.default?.url,
    }))
    .filter((r) => typeof r.id === "string" && r.id);
}
