import { useEffect, useRef, useState } from "react";
import YouTube, { YouTubeEvent, YouTubePlayer } from "react-youtube";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Rule } from "@/components/dashboard/primitives";
import { formatTime } from "@/components/InlineRitualAudioControls";
import { cn } from "@/lib/utils";
import { Pause, Play, SkipBack, SkipForward, Minimize2, Maximize2, X } from "lucide-react";
import { getCurrentTrack, useMusicPlayer } from "@/hooks/use-music-player";

export const RitualMusicPlayer = () => {
  const { queue, isPlaying, volume, viewMode, next, prev, togglePlay, setVolume, setViewMode, currentTime, duration, setPlayback, requestedSeekSeconds, clearSeek } = useMusicPlayer();
  const currentTrack = useMusicPlayer(getCurrentTrack);
  const [player, setPlayer] = useState<YouTubePlayer | null>(null);
  const intervalRef = useRef<number | null>(null);

  const videoId = currentTrack?.id;

  useEffect(() => {
    if (!player) return;
    player.setVolume(volume);
  }, [player, volume]);

  useEffect(() => {
    if (!player) return;
    if (isPlaying) player.playVideo(); else player.pauseVideo();
  }, [player, isPlaying]);

  useEffect(() => () => { if (intervalRef.current) window.clearInterval(intervalRef.current); }, []);

  useEffect(() => {
    if (!player) return;
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    intervalRef.current = window.setInterval(() => {
      try {
        setPlayback(player.getCurrentTime?.() || 0, player.getDuration?.() || 0);
      } catch {}
    }, 500);
  }, [player, videoId, setPlayback]);

  useEffect(() => {
    if (!player || requestedSeekSeconds == null) return;
    try { player.seekTo(requestedSeekSeconds, true); } catch {}
    clearSeek();
  }, [requestedSeekSeconds, player, clearSeek]);

  const onReady = (e: YouTubeEvent) => {
    const p = e.target as unknown as YouTubePlayer;
    setPlayer(p);
    try { p.setVolume(volume); } catch {}
    // Keep the iframe off-screen and block PiP/miniplayer affordances
    try {
      // @ts-ignore
      const iframe: HTMLIFrameElement | null = (e?.target as any)?.getIframe ? (e.target as any).getIframe() : null;
      if (iframe) {
        iframe.setAttribute('allow', 'autoplay; encrypted-media');
        iframe.setAttribute('disablepictureinpicture', 'true');
        iframe.setAttribute('controlslist', 'nodownload noplaybackrate nofullscreen');
        Object.assign(iframe.style, { position: 'fixed', top: '-10000px', left: '-10000px', width: '1px', height: '1px', opacity: '0', pointerEvents: 'none' });
      }
    } catch {}
  };

  const seekFromClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const target = (duration || 0) * Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    setPlayback(target, duration || 0);
    try { player?.seekTo(target, true); } catch {}
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const Transport = ({ size = "sm" }: { size?: "sm" | "md" }) => {
    const icon = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";
    const btn = size === "md" ? "h-9 w-9" : "h-8 w-8";
    return (
      <div className="flex items-center gap-0.5">
        <Button variant="ghost" size="icon" className={btn} onClick={() => prev()} disabled={!queue.length} aria-label="Previous">
          <SkipBack className={icon} />
        </Button>
        <Button variant={isPlaying ? "outline" : "default"} size="icon" className={btn} onClick={() => togglePlay()} disabled={!videoId} aria-label={isPlaying ? "Pause" : "Play"}>
          {isPlaying ? <Pause className={icon} /> : <Play className={icon} />}
        </Button>
        <Button variant="ghost" size="icon" className={btn} onClick={() => next()} disabled={!queue.length} aria-label="Next">
          <SkipForward className={icon} />
        </Button>
      </div>
    );
  };

  const Art = ({ className }: { className?: string }) => (
    <div className={cn("shrink-0 overflow-hidden border border-border bg-muted", className)}>
      {currentTrack && <img src={currentTrack.thumbnailUrl} alt="" className="h-full w-full object-cover" />}
    </div>
  );

  const Mini = (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-[400px] z-50">
      <div className="border border-border bg-background shadow-[0_8px_24px_-12px_rgba(0,0,0,0.25)]">
        <div onClick={seekFromClick} className="cursor-pointer">
          <Rule value={progress} />
        </div>
        <div className="flex items-center gap-3 p-3">
          <Art className="h-10 w-10" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm leading-tight">{currentTrack?.title || "Nothing playing"}</p>
            <p className="truncate font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              {currentTrack ? `${formatTime(currentTime)} / ${formatTime(duration)}` : "Open Music to pick a track"}
            </p>
          </div>
          <Transport />
          <span className="mx-1 h-5 w-px bg-border" />
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewMode("full")} aria-label="Expand player">
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setViewMode("hidden")} aria-label="Hide player">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );

  const Full = (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-[440px] z-50">
      <div className="border border-border bg-background shadow-[0_8px_24px_-12px_rgba(0,0,0,0.25)]">
        <header className="flex items-center justify-between border-b border-border px-4 py-2">
          <span className="eyebrow">{isPlaying ? "Now playing" : currentTrack ? "Paused" : "Player"}</span>
          <div className="flex items-center">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewMode("mini")} aria-label="Minimise player">
              <Minimize2 className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => setViewMode("hidden")} aria-label="Hide player">
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </header>

        <div className="flex gap-4 p-4">
          <Art className="h-24 w-24" />
          <div className="min-w-0 flex-1">
            <p className="font-serif text-xl leading-tight line-clamp-2">{currentTrack?.title || "Nothing playing"}</p>
            <p className="mt-1 truncate text-xs text-muted-foreground">{currentTrack?.channelTitle}</p>

            <div className="mt-4 cursor-pointer py-1" onClick={seekFromClick} role="slider" aria-label="Seek" aria-valuenow={Math.round(currentTime)} aria-valuemin={0} aria-valuemax={Math.round(duration)}>
              <Rule value={progress} />
            </div>
            <div className="mt-1.5 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground tabular-nums">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-border px-4 py-3">
          <Transport size="md" />
          <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            <span>Vol</span>
            <Slider value={[volume]} onValueChange={(v) => setVolume(v[0])} min={0} max={100} step={1} className="w-28" aria-label="Volume" />
            <span className="w-7 text-right tabular-nums">{volume}</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Hidden YouTube player keeps audio alive across the app */}
      <div aria-hidden style={{ position: 'fixed', top: -10000, left: -10000, width: 1, height: 1, opacity: 0, pointerEvents: 'none', zIndex: -1 }}>
        {videoId ? (
          <YouTube
            videoId={videoId}
            className="w-[1px] h-[1px] opacity-0 pointer-events-none"
            iframeClassName="w-[1px] h-[1px] opacity-0 pointer-events-none"
            opts={{
              height: '1',
              width: '1',
              playerVars: { autoplay: 1, controls: 0, modestbranding: 1, rel: 0, playsinline: 1, disablekb: 1, iv_load_policy: 3, fs: 0 },
            }}
            onReady={onReady}
            onEnd={() => next()}
          />
        ) : null}
      </div>
      {viewMode === "hidden" ? null : viewMode === "mini" ? Mini : Full}
    </>
  );
};
