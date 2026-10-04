import { create } from "zustand";

export interface YouTubeTrack {
  id: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  durationSeconds?: number;
}

export type PlayerViewMode = "full" | "mini" | "hidden";

/** Minimal surface of the YouTube iframe player we drive from the store. */
export interface PlayerHandle {
  playVideo: () => void;
  pauseVideo: () => void;
}

interface PlayerState {
  queue: YouTubeTrack[];
  currentIndex: number;
  isPlaying: boolean;
  /** True when the browser refused to start audio (iOS autoplay policy) — UI should ask for a tap. */
  playbackBlocked: boolean;
  volume: number; // 0..100
  viewMode: PlayerViewMode;
  currentTime: number; // seconds
  duration: number; // seconds
  requestedSeekSeconds: number | null;
  player: PlayerHandle | null;

  setQueue: (tracks: YouTubeTrack[], startIndex?: number) => void;
  addToQueue: (track: YouTubeTrack) => void;
  playTrack: (track: YouTubeTrack, replaceQueue?: boolean) => void;
  next: () => void;
  prev: () => void;
  togglePlay: (playing?: boolean) => void;
  setVolume: (volume: number) => void;
  setViewMode: (mode: PlayerViewMode) => void;
  setPlayback: (currentTime: number, duration: number) => void;
  requestSeek: (seconds: number) => void;
  clearSeek: () => void;
  setPlayer: (player: PlayerHandle | null) => void;
  /** Called from YouTube player-state events so UI reflects what is actually audible. */
  syncFromPlayer: (playing: boolean) => void;
  setPlaybackBlocked: (blocked: boolean) => void;
}

export const useMusicPlayer = create<PlayerState>((set, get) => ({
  queue: [],
  currentIndex: -1,
  isPlaying: false,
  playbackBlocked: false,
  volume: 60,
  viewMode: "hidden",
  currentTime: 0,
  duration: 0,
  requestedSeekSeconds: null,
  player: null,

  setQueue: (tracks, startIndex = 0) => {
    set({ queue: tracks, currentIndex: startIndex, isPlaying: true, viewMode: "mini", currentTime: 0, duration: 0 });
  },
  addToQueue: (track) => set({ queue: [...get().queue, track] }),
  playTrack: (track, replaceQueue = false) => {
    if (replaceQueue) {
      set({ queue: [track], currentIndex: 0, isPlaying: true, viewMode: "mini", currentTime: 0, duration: 0 });
    } else {
      const existingIdx = get().queue.findIndex((t) => t.id === track.id);
      if (existingIdx >= 0) {
        set({ currentIndex: existingIdx, isPlaying: true, viewMode: "mini", currentTime: 0, duration: 0 });
      } else {
        const newQueue = [...get().queue, track];
        set({ queue: newQueue, currentIndex: newQueue.length - 1, isPlaying: true, viewMode: "mini", currentTime: 0, duration: 0 });
      }
    }
  },
  next: () => {
    const { queue, currentIndex } = get();
    if (queue.length === 0) return;
    const nextIndex = (currentIndex + 1) % queue.length;
    set({ currentIndex: nextIndex, isPlaying: true, currentTime: 0, duration: 0 });
  },
  prev: () => {
    const { queue, currentIndex } = get();
    if (queue.length === 0) return;
    const prevIndex = (currentIndex - 1 + queue.length) % queue.length;
    set({ currentIndex: prevIndex, isPlaying: true, currentTime: 0, duration: 0 });
  },
  togglePlay: (playing) => {
    const isPlaying = playing ?? !get().isPlaying;
    // Drive the iframe synchronously so iOS still sees the tap as the activating user gesture.
    const player = get().player;
    try {
      if (isPlaying) player?.playVideo(); else player?.pauseVideo();
    } catch { /* iframe not ready yet; the effect in RitualMusicPlayer retries */ }
    set({ isPlaying, playbackBlocked: false });
  },
  setVolume: (volume) => set({ volume: Math.max(0, Math.min(100, volume)) }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setPlayback: (currentTime, duration) => set({ currentTime, duration }),
  requestSeek: (seconds) => set({ requestedSeekSeconds: Math.max(0, seconds) }),
  clearSeek: () => set({ requestedSeekSeconds: null }),
  setPlayer: (player) => set({ player }),
  syncFromPlayer: (playing) => {
    if (get().isPlaying !== playing) set({ isPlaying: playing });
    if (playing && get().playbackBlocked) set({ playbackBlocked: false });
  },
  setPlaybackBlocked: (blocked) => set({ playbackBlocked: blocked, ...(blocked ? { isPlaying: false } : {}) }),
}));

export const getCurrentTrack = (state: PlayerState) =>
  state.currentIndex >= 0 ? state.queue[state.currentIndex] : undefined;


