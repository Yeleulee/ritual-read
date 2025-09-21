import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { searchYouTube } from "@/lib/youtube";
import { useMusicPlayer } from "@/hooks/use-music-player";
import { Loader2, Play } from "lucide-react";

export const RitualMusicSearch = () => {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState<string>("");
  const { playTrack, setViewMode } = useMusicPlayer();

  const doSearch = async (q?: string) => {
    const search = (q ?? query).trim();
    if (!search) return;
    setLoading(true);
    setError("");
    try {
      const items = await searchYouTube(search);
      setResults(items);
      if (items.length === 0) setError("No results. Try a different query.");
    } catch (e: any) {
      setResults([]);
      setError(e?.message || "Search failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">Ritual Music</div>
        <div className="text-[11px] text-muted-foreground">Ambient • Binaural • Lofi</div>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Search music, binaural beats, ambient…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") doSearch();
          }}
        />
        <Button onClick={() => doSearch()} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 max-h-80 overflow-auto pr-1">
        {error && <div className="text-xs text-destructive">{error}</div>}
        {loading && (
          <>
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </>
        )}
        {!loading && results.map((r) => (
          <Card key={r.id} className="p-2 flex gap-3 items-center hover:bg-muted/40 transition-colors rounded-lg border-border/60">
            <div className="w-16 h-10 rounded-md overflow-hidden bg-muted shadow-sm">
              <img src={r.thumbnailUrl} alt={r.title} className="w-full h-full object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">{r.title}</div>
              <div className="text-[11px] text-muted-foreground truncate">{r.channelTitle}</div>
            </div>
            <Button
              size="sm"
              onClick={() => {
                playTrack({ id: r.id, title: r.title, channelTitle: r.channelTitle, thumbnailUrl: r.thumbnailUrl }, false);
                setViewMode("mini");
              }}
              className="shrink-0"
            >
              <Play className="w-4 h-4 mr-1" />
              Play
            </Button>
          </Card>
        ))}
        {!loading && results.length === 0 && (
          <div className="text-sm text-muted-foreground px-1">Try searching “lofi hip hop”, “brown noise”, or “alpha waves”.</div>
        )}
      </div>
    </div>
  );
};


