import { useEffect, useRef, useState } from "react";
import YouTube, { YouTubeEvent, YouTubePlayer } from "react-youtube";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { SeekBar } from "@/components/SeekBar";
import { formatTime } from "@/components/InlineRitualAudioControls";
import { cn } from "@/lib/utils";
import { Pause, Play, SkipBack, SkipForward, Minimize2, Maximize2, X } from "lucide-react";
import { getCurrentTrack, useMusicPlayer, type YouTubeTrack } from "@/hooks/use-music-player";

// YT.PlayerState values (the iframe API enum is not importable here)
const YT_PLAYING = 1;
const YT_BUFFERING = 3;

/* Stable components at module level. Declared inside the player they would be a new type on
   every render — and the player re-renders twice a second for the time display — so React
   remounted the buttons constantly: they flickered and taps landing mid-remount were dropped. */
function Transport({ size = "sm" }: { size?: "sm" | "md" }) {
  const hasQueue = useMusicPlayer((s) => s.queue.length > 0);
  const isPlaying = useMusicPlayer((s) => s.isPlaying);
  const hasTrack = useMusicPlayer((s) => s.currentIndex >= 0);
  const { next, prev, togglePlay } = useMusicPlayer.getState();
  const icon = size === "md" ? "h-5 w-5" : "h-4 w-4";
  const btn = size === "md" ? "h-11 w-11" : "h-10 w-10";
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button variant="ghost" size="icon" className={btn} onClick={() => prev()} disabled={!hasQueue} aria-label="Previous">
        <SkipBack className={icon} />
      </Button>
      <Button variant={isPlaying ? "outline" : "default"} size="icon" className="h-11 w-11" onClick={() => togglePlay()} disabled={!hasTrack} aria-label={isPlaying ? "Pause" : "Play"}>
        {isPlaying ? <Pause className={icon} /> : <Play className={icon} />}
      </Button>
      <Button variant="ghost" size="icon" className={btn} onClick={() => next()} disabled={!hasQueue} aria-label="Next">
        <SkipForward className={icon} />
      </Button>
    </div>
  );
}

function Art({ track, className }: { track?: YouTubeTrack; className?: string }) {
  return (
    <div className={cn("shrink-0 overflow-hidden border border-border bg-muted", className)}>
      {track && <img src={track.thumbnailUrl} alt="" className="h-full w-full object-cover" />}
    </div>
  );
}

export const RitualMusicPlayer = () => {
  const { isPlaying, playbackBlocked, volume, viewMode, next, setVolume, setViewMode, currentTime, duration, setPlayback, requestedSeekSeconds, clearSeek, requestSeek, setPlayer: publishPlayer, syncFromPlayer, setPlaybackBlocked } = useMusicPlayer();
  const currentTrack = useMusicPlayer(getCurrentTrack);
  const [player, setPlayer] = useState<YouTubePlayer | null>(null);
  const intervalRef = useRef<number | null>(null);
  const watchdogRef = useRef<number | null>(null);

  const videoId = currentTrack?.id;

  useEffect(() => {
    if (!player) return;
    player.setVolume(volume);
  }, [player, volume]);

  useEffect(() => {
    if (!player) return;
    if (isPlaying) player.playVideo(); else player.pauseVideo();
  }, [player, isPlaying]);

  // If the browser (iOS) refuses to start audio, stop claiming we are playing and ask for a tap.
  useEffect(() => {
    if (watchdogRef.current) window.clearTimeout(watchdogRef.current);
    if (!player || !isPlaying || !videoId) return;
    watchdogRef.current = window.setTimeout(() => {
      try {
        const state = player.getPlayerState?.();
        if (state !== YT_PLAYING && state !== YT_BUFFERING) setPlaybackBlocked(true);
      } catch { /* player torn down */ }
    }, 2500);
    return () => { if (watchdogRef.current) window.clearTimeout(watchdogRef.current); };
  }, [player, isPlaying, videoId, setPlaybackBlocked]);

  useEffect(() => () => {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    publishPlayer(null);
  }, [publishPlayer]);

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
    publishPlayer(p);
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

  const onStateChange = (e: YouTubeEvent<number>) => {
    const state = e.data;
    if (state === YT_PLAYING || state === YT_BUFFERING) syncFromPlayer(true);
    else if (state === 2 /* PAUSED */) syncFromPlayer(false);
  };

  const statusLabel = playbackBlocked ? "Tap play to start" : isPlaying ? "Now playing" : currentTrack ? "Paused" : "Player";

  const Mini = (
    <div className="fixed left-4 right-4 z-50 bottom-[max(16px,env(safe-area-inset-bottom))] md:left-auto md:right-4 md:w-[400px]">
      <div className="border border-border bg-background shadow-[0_8px_24px_-12px_rgba(0,0,0,0.25)]">
        <div className="flex items-center gap-3 p-3">
          <Art track={currentTrack} className="h-10 w-10" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm leading-tight">{currentTrack?.title || "Nothing playing"}</p>
            <p className="truncate font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              {playbackBlocked ? "Tap play to start" : currentTrack ? `${formatTime(currentTime)} / ${formatTime(duration)}` : "Open Music to pick a track"}
            </p>
          </div>
          <Transport />
          <span className="mx-1 hidden h-5 w-px bg-border sm:block" />
          <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => setViewMode("full")} aria-label="Expand player">
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground" onClick={() => setViewMode("hidden")} aria-label="Hide player">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <SeekBar currentTime={currentTime} duration={duration} onSeek={requestSeek} className="h-6 px-3" />
      </div>
    </div>
  );

  const Full = (
    <div className="fixed left-4 right-4 z-50 bottom-[max(16px,env(safe-area-inset-bottom))] md:left-auto md:right-4 md:w-[440px]">
      <div className="border border-border bg-background shadow-[0_8px_24px_-12px_rgba(0,0,0,0.25)]">
        <header className="flex items-center justify-between border-b border-border py-1 pl-4 pr-1">
          <span className="eyebrow">{statusLabel}</span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => setViewMode("mini")} aria-label="Minimise player">
              <Minimize2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground" onClick={() => setViewMode("hidden")} aria-label="Hide player">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <div className="flex gap-4 p-4">
          <Art track={currentTrack} className="h-24 w-24" />
          <div className="min-w-0 flex-1">
            <p className="font-serif text-xl leading-tight line-clamp-2">{currentTrack?.title || "Nothing playing"}</p>
            <p className="mt-1 truncate text-xs text-muted-foreground">{currentTrack?.channelTitle}</p>

            <SeekBar currentTime={currentTime} duration={duration} onSeek={requestSeek} className="mt-2" />
            <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground tabular-nums">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border px-4 py-3">
          <Transport size="md" />
          <div className="flex min-h-11 items-center gap-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            <span>Vol</span>
            <Slider value={[volume]} onValueChange={(v) => setVolume(v[0])} min={0} max={100} step={1} className="h-11 w-28" aria-label="Volume" />
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
            onStateChange={onStateChange}
            onEnd={() => next()}
          />
        ) : null}
      </div>
      {viewMode === "hidden" ? null : viewMode === "mini" ? Mini : Full}
    </>
  );
};
