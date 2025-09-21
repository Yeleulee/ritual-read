import { useEffect, useMemo, useRef, useState } from "react";
import YouTube, { YouTubeEvent, YouTubePlayer } from "react-youtube";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Pause, Play, SkipBack, SkipForward, Volume2, Minimize2, Maximize2, Music2 } from "lucide-react";
import { getCurrentTrack, useMusicPlayer } from "@/hooks/use-music-player";

export const RitualMusicPlayer = () => {
  const { queue, isPlaying, volume, viewMode, next, prev, togglePlay, setVolume, setViewMode, currentTime, duration, setPlayback, requestedSeekSeconds, clearSeek } = useMusicPlayer();
  const currentTrack = useMusicPlayer(getCurrentTrack);
  const [player, setPlayer] = useState<YouTubePlayer | null>(null);
  const intervalRef = useRef<number | null>(null);

  const videoId = currentTrack?.id;

  // Keep iframe player volume and play/pause in sync
  useEffect(() => {
    if (!player) return;
    player.setVolume(volume);
  }, [player, volume]);

  useEffect(() => {
    if (!player) return;
    if (isPlaying) player.playVideo(); else player.pauseVideo();
  }, [player, isPlaying]);

  useEffect(() => {
    // cleanup interval on unmount
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (!player) return;
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    intervalRef.current = window.setInterval(() => {
      try {
        const d = player.getDuration?.() || 0;
        const t = player.getCurrentTime?.() || 0;
        setPlayback(t, d);
      } catch {}
    }, 500);
  }, [player, videoId, setPlayback]);

  // Apply requested seek from store
  useEffect(() => {
    if (!player) return;
    if (requestedSeekSeconds == null) return;
    try {
      player.seekTo(requestedSeekSeconds, true);
    } catch {}
    clearSeek();
  }, [requestedSeekSeconds, player, clearSeek]);

  const onReady = (e: YouTubeEvent) => {
    const p = e.target as unknown as YouTubePlayer;
    setPlayer(p);
    try { p.setVolume(volume); } catch {}
    // Prevent browser Picture-in-Picture/miniplayer UI by removing permission from the iframe
    try {
      // @ts-ignore
      const iframe: HTMLIFrameElement | null = (e?.target as any)?.getIframe ? (e.target as any).getIframe() : null;
      if (iframe) {
        iframe.setAttribute('allow', 'autoplay; encrypted-media');
        iframe.setAttribute('disablepictureinpicture', 'true');
        iframe.setAttribute('controlslist', 'nodownload noplaybackrate nofullscreen');
        iframe.style.position = 'fixed';
        iframe.style.top = '-10000px';
        iframe.style.left = '-10000px';
        iframe.style.width = '1px';
        iframe.style.height = '1px';
        iframe.style.opacity = '0';
        iframe.style.pointerEvents = 'none';
      }
    } catch {}
  };

  const onEnd = () => {
    next();
  };

  if (viewMode === "hidden") return null;

  const Mini = (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 z-50">
      <Card className="shadow-xl border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="p-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-muted flex items-center justify-center overflow-hidden">
            {currentTrack ? (
              <img src={currentTrack.thumbnailUrl} alt={currentTrack.title} className="w-full h-full object-cover" />
            ) : (
              <Music2 className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate max-w-[180px]">{currentTrack?.title || "No track selected"}</div>
            <div className="text-xs text-muted-foreground truncate max-w-[180px]">{currentTrack?.channelTitle || ""}</div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => prev()} disabled={!queue.length} className="h-8 w-8">
              <SkipBack className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => togglePlay()} disabled={!videoId} className="h-8 w-8">
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => next()} disabled={!queue.length} className="h-8 w-8">
              <SkipForward className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setViewMode("full")} className="h-8 w-8">
              <Maximize2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );

  const Full = (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-[420px] z-50">
      <Card className="shadow-2xl border-border/60 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="p-4 flex gap-4">
          <div className="w-20 h-20 md:w-24 md:h-24 rounded overflow-hidden bg-muted flex items-center justify-center">
            {currentTrack ? (
              <img src={currentTrack.thumbnailUrl} alt={currentTrack.title} className="w-full h-full object-cover" />
            ) : (
              <Music2 className="w-6 h-6 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{currentTrack?.title || "Nothing playing"}</div>
                <div className="text-[11px] text-muted-foreground truncate">{currentTrack?.channelTitle || ""}</div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setViewMode("mini")}>
                <Minimize2 className="w-4 h-4" />
              </Button>
            </div>

            <div className="mt-3 group">
              <div
                className="h-3 flex items-center"
                onClick={(e) => {
                  const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const ratio = Math.max(0, Math.min(1, x / rect.width));
                  const target = (duration || 0) * ratio;
                  setPlayback(target, duration || 0);
                  try { player?.seekTo(target, true); } catch {}
                }}
              >
                <Progress value={duration > 0 ? (currentTime / duration) * 100 : 0} className="h-1 w-full cursor-pointer" />
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <Button variant="secondary" size="icon" onClick={() => prev()} disabled={!queue.length}>
                <SkipBack className="w-4 h-4" />
              </Button>
              <Button variant="secondary" size="icon" onClick={() => togglePlay()} disabled={!videoId}>
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </Button>
              <Button variant="secondary" size="icon" onClick={() => next()} disabled={!queue.length}>
                <SkipForward className="w-4 h-4" />
              </Button>
              <div className="flex items-center gap-2 ml-2">
                <Volume2 className="w-4 h-4 text-muted-foreground" />
                <div className="w-24 md:w-32">
                  <Slider value={[volume]} onValueChange={(v) => setVolume(v[0])} min={0} max={100} step={1} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );

function formatTime(seconds?: number) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

  return (
    <>
      {/* Hidden YouTube player to keep audio persistent (never visible) */}
      <div
        aria-hidden
        style={{ position: 'fixed', top: -10000, left: -10000, width: 1, height: 1, opacity: 0, pointerEvents: 'none', zIndex: -1 }}
      >
        {videoId ? (
          <YouTube
            videoId={videoId}
            className="w-[1px] h-[1px] opacity-0 pointer-events-none"
            iframeClassName="w-[1px] h-[1px] opacity-0 pointer-events-none"
            opts={{
              height: '1',
              width: '1',
              playerVars: {
                autoplay: 1,
                controls: 0,
                modestbranding: 1,
                rel: 0,
                playsinline: 1,
                disablekb: 1,
                iv_load_policy: 3,
                // Attempt to prevent PiP/miniplayer UI
                fs: 0,
              },
            }}
            onReady={onReady}
            onEnd={onEnd}
          />
        ) : null}
      </div>
      {viewMode === "mini" ? Mini : Full}
    </>
  );
};


