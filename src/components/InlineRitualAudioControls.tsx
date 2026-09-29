import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Rule } from "@/components/dashboard/primitives";
import { getCurrentTrack, useMusicPlayer } from "@/hooks/use-music-player";
import { cn } from "@/lib/utils";
import { Maximize2, Pause, Play, SkipBack, SkipForward } from "lucide-react";

export const formatTime = (seconds?: number) => {
  const s = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
};

/** "Now playing" strip inside the music dialog. */
export const InlineRitualAudioControls = () => {
  const { queue, isPlaying, volume, next, prev, togglePlay, setVolume, setViewMode, currentTime, duration, requestSeek } = useMusicPlayer();
  const track = useMusicPlayer(getCurrentTrack);
  const hasQueue = queue.length > 0;

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    requestSeek((duration || 0) * Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)));
  };

  return (
    <section className="border-y border-border bg-card px-6 py-4">
      <div className="flex items-center gap-4">
        <div className={cn("h-12 w-12 shrink-0 overflow-hidden border border-border bg-muted", !track && "flex items-center justify-center")}>
          {track ? (
            <img src={track.thumbnailUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="font-serif italic text-muted-foreground">·</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="eyebrow">{track ? (isPlaying ? "Now playing" : "Paused") : "Nothing playing"}</p>
          <p className="mt-0.5 truncate font-serif text-lg leading-tight">{track?.title || "Pick a track below"}</p>
          {track && <p className="truncate text-xs text-muted-foreground">{track.channelTitle}</p>}
        </div>

        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => prev()} disabled={!hasQueue} aria-label="Previous">
            <SkipBack className="h-4 w-4" />
          </Button>
          <Button variant={isPlaying ? "outline" : "default"} size="icon" className="h-9 w-9" onClick={() => togglePlay()} disabled={!hasQueue} aria-label={isPlaying ? "Pause" : "Play"}>
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => next()} disabled={!hasQueue} aria-label="Next">
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {track && (
        <div className="mt-4">
          <div className="cursor-pointer py-1" onClick={seek} role="slider" aria-label="Seek" aria-valuenow={Math.round(currentTime)} aria-valuemin={0} aria-valuemax={Math.round(duration)}>
            <Rule value={duration > 0 ? (currentTime / duration) * 100 : 0} />
          </div>
          <div className="mt-1.5 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground tabular-nums">
            <span>{formatTime(currentTime)}</span>
            <div className="flex items-center gap-3">
              <span>Vol</span>
              <Slider value={[volume]} onValueChange={(v) => setVolume(v[0])} min={0} max={100} step={1} className="w-24" aria-label="Volume" />
              <span className="w-7 text-right">{volume}</span>
              <button type="button" onClick={() => setViewMode("full")} className="ml-2 inline-flex items-center gap-1 hover:text-foreground transition-colors">
                <Maximize2 className="h-3 w-3" /> Player
              </button>
            </div>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      )}
    </section>
  );
};
