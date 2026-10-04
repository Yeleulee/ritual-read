import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { SeekBar } from "@/components/SeekBar";
import { getCurrentTrack, useMusicPlayer } from "@/hooks/use-music-player";
import { cn } from "@/lib/utils";
import { Maximize2, Pause, Play, SkipBack, SkipForward } from "lucide-react";

export const formatTime = (seconds?: number) => {
  const s = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
};

/** "Now playing" strip inside the music dialog. */
export const InlineRitualAudioControls = () => {
  const { queue, isPlaying, playbackBlocked, volume, next, prev, togglePlay, setVolume, setViewMode, currentTime, duration, requestSeek } = useMusicPlayer();
  const track = useMusicPlayer(getCurrentTrack);
  const hasQueue = queue.length > 0;

  return (
    <section className="border-y border-border bg-card px-4 py-4 sm:px-6">
      <div className="flex items-center gap-3 sm:gap-4">
        <div className={cn("h-12 w-12 shrink-0 overflow-hidden border border-border bg-muted", !track && "flex items-center justify-center")}>
          {track ? (
            <img src={track.thumbnailUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="font-serif italic text-muted-foreground">·</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="eyebrow">{track ? (playbackBlocked ? "Tap play to start" : isPlaying ? "Now playing" : "Paused") : "Nothing playing"}</p>
          <p className="mt-0.5 truncate font-serif text-lg leading-tight">{track?.title || "Pick a track below"}</p>
          {track && <p className="truncate text-xs text-muted-foreground">{track.channelTitle}</p>}
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => prev()} disabled={!hasQueue} aria-label="Previous">
            <SkipBack className="h-4 w-4" />
          </Button>
          <Button variant={isPlaying ? "outline" : "default"} size="icon" className="h-11 w-11" onClick={() => togglePlay()} disabled={!hasQueue} aria-label={isPlaying ? "Pause" : "Play"}>
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => next()} disabled={!hasQueue} aria-label="Next">
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {track && (
        <div className="mt-2">
          <SeekBar currentTime={currentTime} duration={duration} onSeek={requestSeek} />
          <div className="flex flex-wrap items-center justify-between gap-y-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground tabular-nums">
            <span>{formatTime(currentTime)}</span>
            <div className="flex items-center gap-3">
              <span>Vol</span>
              <Slider value={[volume]} onValueChange={(v) => setVolume(v[0])} min={0} max={100} step={1} className="h-11 w-24" aria-label="Volume" />
              <span className="w-7 text-right">{volume}</span>
              <button type="button" onClick={() => setViewMode("full")} className="ml-1 inline-flex min-h-11 items-center gap-1 px-2 transition-colors hover:text-foreground">
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
