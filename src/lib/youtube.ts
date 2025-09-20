export interface YouTubeSearchResult {
  id: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
}

const YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";

export async function searchYouTube(query: string, apiKey?: string): Promise<YouTubeSearchResult[]> {
  const key = apiKey ?? import.meta.env.VITE_YOUTUBE_API_KEY;
  if (!key) {
    // Graceful degrade with empty results to avoid runtime crashes
    return [];
  }
  const params = new URLSearchParams({
    part: "snippet",
    q: query,
    type: "video",
    maxResults: "10",
    key,
  });

  const response = await fetch(`${YOUTUBE_SEARCH_URL}?${params.toString()}`);
  if (!response.ok) {
    return [];
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


