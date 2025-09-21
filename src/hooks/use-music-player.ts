import { create } from "zustand";

export interface YouTubeTrack {
  id: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  durationSeconds?: number;
}

export type PlayerViewMode = "full" | "mini" | "hidden";

interface PlayerState {
  queue: YouTubeTrack[];
  currentIndex: number;
  isPlaying: boolean;
  volume: number; // 0..100
  viewMode: PlayerViewMode;
  currentTime: number; // seconds
  duration: number; // seconds
  requestedSeekSeconds: number | null;

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
}

export const useMusicPlayer = create<PlayerState>((set, get) => ({
  queue: [],
  currentIndex: -1,
  isPlaying: false,
  volume: 60,
  viewMode: "hidden",
  currentTime: 0,
  duration: 0,
  requestedSeekSeconds: null,

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
    set({ isPlaying });
  },
  setVolume: (volume) => set({ volume: Math.max(0, Math.min(100, volume)) }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setPlayback: (currentTime, duration) => set({ currentTime, duration }),
  requestSeek: (seconds) => set({ requestedSeekSeconds: Math.max(0, seconds) }),
  clearSeek: () => set({ requestedSeekSeconds: null }),
}));

export const getCurrentTrack = (state: PlayerState) =>
  state.currentIndex >= 0 ? state.queue[state.currentIndex] : undefined;


