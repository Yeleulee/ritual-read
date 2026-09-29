import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

// Upstream error bodies can echo the API key; only ever return our own wording to the browser.
const friendly = (status: number, reason?: string) => {
  if (status === 403 && /suspended|disabled|blocked/i.test(reason ?? '')) return 'Music search is temporarily unavailable.';
  if (status === 403 || status === 429) return 'Music search quota reached. Try again later.';
  if (status === 400) return 'Music search could not understand that query.';
  return 'Music search failed. Try again later.';
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const q = url.searchParams.get('q') || '';
    if (!q) return json({ items: [] });

    const apiKey = Deno.env.get('YOUTUBE_API_KEY');
    if (!apiKey) {
      console.error('youtube-search: YOUTUBE_API_KEY secret is not set');
      return json({ error: 'Music search is not configured.' }, 503);
    }

    const params = new URLSearchParams({
      part: 'snippet',
      q,
      type: 'video',
      maxResults: '10',
      key: apiKey,
      safeSearch: 'none',
      relevanceLanguage: 'en',
    });

    // The key is HTTP-referrer restricted in Google Cloud; forward the caller's origin so
    // Google applies the same allow-list it would for a direct browser request.
    const referer = req.headers.get('origin') || req.headers.get('referer') || Deno.env.get('YOUTUBE_REFERER') || '';
    const yt = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`, {
      headers: referer ? { Referer: referer.endsWith('/') ? referer : `${referer}/` } : {},
    });

    if (!yt.ok) {
      let reason = '';
      try {
        const body = await yt.json();
        reason = [body?.error?.errors?.[0]?.reason, body?.error?.status, body?.error?.message].filter(Boolean).join(' | ');
      } catch { /* non-JSON upstream error */ }
      // Server log only — never sent to the client
      console.error(`youtube-search: upstream ${yt.status}`, reason.replace(/AIza[\w-]+/g, '<key>'));
      return json({ error: friendly(yt.status, reason) }, yt.status === 429 ? 429 : 502);
    }

    const data = await yt.json();
    const items = ((data?.items ?? []) as any[]).map((item) => ({
      id: item?.id?.videoId,
      title: item?.snippet?.title,
      channelTitle: item?.snippet?.channelTitle,
      thumbnailUrl: item?.snippet?.thumbnails?.medium?.url || item?.snippet?.thumbnails?.default?.url,
    })).filter((r) => !!r.id);

    return json({ items });
  } catch (e) {
    console.error('youtube-search: unhandled', e);
    return json({ error: 'Music search failed. Try again later.' }, 500);
  }
});
