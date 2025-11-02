import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { searchYouTube } from "@/lib/youtube";
import { useMusicPlayer } from "@/hooks/use-music-player";
import { Loader2, Play, Music, Headphones, Waves, Sparkles } from "lucide-react";

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

  // Suggested music categories for quick access
  const quickCategories = [
    { name: "Focus", query: "focus music binaural beats", icon: "🎯" },
    { name: "Calm", query: "ambient meditation music", icon: "🧘" },
    { name: "Energy", query: "upbeat instrumental music", icon: "⚡" },
    { name: "Nature", query: "rain forest sounds ambient", icon: "🌿" }
  ];

  // Auto-search popular focus music on component mount
  useEffect(() => {
    doSearch("focus music for reading");
  }, []);

  return (
    <div className="space-y-4">
      {/* Enhanced Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/10 via-purple-500/10 to-pink-500/10 p-4 border border-primary/20">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center shadow-lg">
              <Music className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-lg font-bold bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
                Ritual Music
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Headphones className="w-3 h-3" />
                Enhance your reading experience
              </div>
            </div>
          </div>
          <div className="flex gap-1">
            <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">
              <Waves className="w-3 h-3 mr-1" />
              Ambient
            </Badge>
          </div>
        </div>
      </div>

      {/* Quick Categories */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {quickCategories.map((cat) => (
          <Button
            key={cat.name}
            variant="outline"
            size="sm"
            onClick={() => doSearch(cat.query)}
            className="h-auto p-3 flex flex-col items-center gap-1 hover:bg-primary/5 hover:border-primary/30 transition-all duration-200"
          >
            <span className="text-lg">{cat.icon}</span>
            <span className="text-xs font-medium">{cat.name}</span>
          </Button>
        ))}
      </div>

      {/* Enhanced Search */}
      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              placeholder="Search for focus music, nature sounds, binaural beats..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") doSearch();
              }}
              className="pl-10 bg-background/50 border-primary/20 focus:border-primary/40"
            />
            <Sparkles className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-primary/60" />
          </div>
          <Button onClick={() => doSearch()} disabled={loading} className="bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
          </Button>
        </div>
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
        {!loading && results.map((r, index) => (
          <Card key={r.id} className="group p-3 flex gap-3 items-center hover:bg-gradient-to-r hover:from-primary/5 hover:to-purple-500/5 transition-all duration-300 rounded-xl border-border/40 hover:border-primary/30 hover:shadow-lg">
            <div className="relative w-16 h-12 rounded-lg overflow-hidden bg-gradient-to-br from-primary/10 to-purple-500/10 shadow-md">
              <img src={r.thumbnailUrl} alt={r.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{r.title}</div>
              <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                <Music className="w-3 h-3" />
                {r.channelTitle}
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => {
                playTrack({ id: r.id, title: r.title, channelTitle: r.channelTitle, thumbnailUrl: r.thumbnailUrl }, false);
                setViewMode("mini");
              }}
              className="shrink-0 bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90 shadow-md hover:shadow-lg transition-all duration-200"
            >
              <Play className="w-4 h-4 mr-1" />
              Play
            </Button>
          </Card>
        ))}
        {!loading && results.length === 0 && query && (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary/10 to-purple-500/10 flex items-center justify-center">
              <Music className="w-8 h-8 text-primary/60" />
            </div>
            <div className="text-sm font-medium text-muted-foreground mb-2">No results found</div>
            <div className="text-xs text-muted-foreground">Try searching "lofi hip hop", "brown noise", or "alpha waves"</div>
          </div>
        )}
      </div>
    </div>
  );
};

