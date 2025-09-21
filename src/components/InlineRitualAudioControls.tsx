import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { getCurrentTrack, useMusicPlayer } from "@/hooks/use-music-player";
import { Maximize2, Music2, Pause, Play, SkipBack, SkipForward, Volume2 } from "lucide-react";

export const InlineRitualAudioControls = () => {
  const { queue, isPlaying, volume, next, prev, togglePlay, setVolume, setViewMode, currentTime, duration, requestSeek } = useMusicPlayer();
  const currentTrack = useMusicPlayer(getCurrentTrack);

  return (
    <Card className="p-3 border-border/60">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-md overflow-hidden bg-muted flex items-center justify-center shadow-sm">
          {currentTrack ? (
            <img src={currentTrack.thumbnailUrl} alt={currentTrack.title} className="w-full h-full object-cover" />
          ) : (
            <Music2 className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold truncate">
            {currentTrack?.title || "No track selected"}
          </div>
          <div className="text-[11px] text-muted-foreground truncate">
            {currentTrack?.channelTitle || (queue.length ? "Ready" : "Use search to pick a track")}
          </div>
          <div className="mt-2">
            <div
              className="h-3 flex items-center"
              onClick={(e) => {
                const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                const x = e.clientX - rect.left;
                const ratio = Math.max(0, Math.min(1, x / rect.width));
                const target = (duration || 0) * ratio;
                requestSeek(target);
              }}
            >
              <Progress value={duration > 0 ? (currentTime / duration) * 100 : 0} className="h-1 w-full cursor-pointer" />
            </div>
            <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <Button variant="secondary" size="icon" onClick={() => prev()} disabled={!queue.length}>
          <SkipBack className="w-4 h-4" />
        </Button>
        <Button variant="secondary" size="icon" onClick={() => togglePlay()} disabled={!queue.length}>
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </Button>
        <Button variant="secondary" size="icon" onClick={() => next()} disabled={!queue.length}>
          <SkipForward className="w-4 h-4" />
        </Button>

        <div className="ml-2 flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-muted-foreground" />
          <div className="w-32">
            <Slider value={[volume]} onValueChange={(v) => setVolume(v[0])} min={0} max={100} step={1} />
          </div>
        </div>

        <div className="ml-auto">
          <Button variant="ghost" size="sm" onClick={() => setViewMode("full")}>
            <Maximize2 className="w-4 h-4 mr-1" />
            Open Player
          </Button>
        </div>
      </div>
    </Card>
  );
};

function formatTime(seconds?: number) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}


