import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export interface Track {
  id: string;
  title: string;
  artist: string;
  album?: string | null;
  album_art_url?: string | null;
  youtube_video_id?: string | null;
  spotify_track_id?: string | null;
  duration_seconds?: number | null;
  sourceTable?: "liked_tracks" | "playlist_tracks";
}

export type RepeatMode = "off" | "all" | "one";

interface PlayerContextValue {
  queue: Track[];
  currentIndex: number;
  current: Track | null;
  isPlaying: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  volume: number;
  /** True once persisted state has been restored on the client. */
  hydrated: boolean;
  setIsPlaying: (v: boolean) => void;
  togglePlay: () => void;
  setShuffle: (v: boolean) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  setVolume: (v: number) => void;
  playQueue: (tracks: Track[], startIndex?: number, opts?: { shuffle?: boolean }) => void;
  /** Advance. `auto` = the track ended on its own (respects repeat mode and stops at the end). */
  playNext: (auto?: boolean) => void;
  playPrev: () => void;
  jumpTo: (index: number) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  setTrackVideoId: (trackId: string, videoId: string) => void;
}

const PlayerContext = createContext<PlayerContextValue | undefined>(undefined);

const STORAGE_KEY = "audio-blendr:player:v1";
const REPEAT_ORDER: RepeatMode[] = ["off", "all", "one"];

interface PersistedState {
  queue: Track[];
  currentIndex: number;
  shuffle: boolean;
  repeat: RepeatMode;
  volume: number;
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function readPersisted(): PersistedState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    if (!Array.isArray(parsed.queue)) return null;
    return {
      queue: parsed.queue,
      currentIndex:
        typeof parsed.currentIndex === "number" && parsed.currentIndex < parsed.queue.length
          ? parsed.currentIndex
          : -1,
      shuffle: !!parsed.shuffle,
      repeat: REPEAT_ORDER.includes(parsed.repeat as RepeatMode)
        ? (parsed.repeat as RepeatMode)
        : "off",
      volume: typeof parsed.volume === "number" ? Math.min(100, Math.max(0, parsed.volume)) : 70,
    };
  } catch {
    return null;
  }
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [queue, setQueue] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>("off");
  const [volume, setVolumeState] = useState(70);
  const [hydrated, setHydrated] = useState(false);

  // Refs so the navigation callbacks stay referentially stable for effects.
  const queueRef = useRef(queue);
  const repeatRef = useRef(repeat);
  queueRef.current = queue;
  repeatRef.current = repeat;

  const current = currentIndex >= 0 && currentIndex < queue.length ? queue[currentIndex] : null;

  // Restore the last session's queue after mount (never during SSR) so a page
  // refresh doesn't wipe what you were listening to. Playback stays paused —
  // browsers block autoplay without a gesture anyway.
  useEffect(() => {
    const saved = readPersisted();
    if (saved) {
      setQueue(saved.queue);
      setCurrentIndex(saved.currentIndex);
      setShuffle(saved.shuffle);
      setRepeat(saved.repeat);
      setVolumeState(saved.volume);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      const state: PersistedState = { queue, currentIndex, shuffle, repeat, volume };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage full or unavailable — the player still works, it just won't persist.
    }
  }, [hydrated, queue, currentIndex, shuffle, repeat, volume]);

  // Record a listen the first time each track actually starts playing.
  const lastRecordedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!user || !current || !isPlaying) return;
    if (lastRecordedRef.current === current.id) return;
    lastRecordedRef.current = current.id;
    void supabase
      .from("play_history")
      .insert({
        user_id: user.id,
        title: current.title,
        artist: current.artist,
        album_art_url: current.album_art_url ?? null,
        spotify_track_id: current.spotify_track_id ?? null,
        youtube_video_id: current.youtube_video_id ?? null,
      })
      .then(({ error }) => {
        if (error) console.warn("[player] Failed to record play history", error.message);
      });
  }, [user, current, isPlaying]);

  const playQueue = useCallback((tracks: Track[], startIndex = 0, opts?: { shuffle?: boolean }) => {
    if (tracks.length === 0) return;
    if (opts?.shuffle) {
      setQueue(shuffleArray(tracks));
      setCurrentIndex(0);
      setShuffle(true);
    } else {
      setQueue(tracks);
      setCurrentIndex(Math.min(Math.max(startIndex, 0), tracks.length - 1));
    }
    lastRecordedRef.current = null;
    setIsPlaying(true);
  }, []);

  const playNext = useCallback((auto = false) => {
    setCurrentIndex((i) => {
      const len = queueRef.current.length;
      if (len === 0) return i;
      if (i + 1 < len) return i + 1;
      // At the end of the queue.
      if (repeatRef.current === "all" || !auto) return 0;
      setIsPlaying(false);
      return i;
    });
  }, []);

  const playPrev = useCallback(() => {
    setCurrentIndex((i) => (i > 0 ? i - 1 : i));
  }, []);

  const jumpTo = useCallback((index: number) => {
    if (index < 0 || index >= queueRef.current.length) return;
    setCurrentIndex(index);
    setIsPlaying(true);
  }, []);

  const removeFromQueue = useCallback((index: number) => {
    setQueue((q) => {
      if (index < 0 || index >= q.length) return q;
      const next = q.filter((_, i) => i !== index);
      setCurrentIndex((ci) => {
        if (next.length === 0) {
          setIsPlaying(false);
          return -1;
        }
        if (index < ci) return ci - 1;
        if (index === ci) return Math.min(ci, next.length - 1);
        return ci;
      });
      return next;
    });
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
    setCurrentIndex(-1);
    setIsPlaying(false);
  }, []);

  const toggleShuffle = useCallback(() => {
    setShuffle((prev) => {
      const next = !prev;
      if (next && queueRef.current.length > 1) {
        // Reshuffle what's upcoming; keep the current track where it is.
        setCurrentIndex((ci) => {
          const q = queueRef.current;
          if (ci >= 0) {
            const rest = q.filter((_, i) => i !== ci);
            setQueue([q[ci], ...shuffleArray(rest)]);
            return 0;
          }
          setQueue(shuffleArray(q));
          return ci;
        });
      }
      return next;
    });
  }, []);

  const cycleRepeat = useCallback(() => {
    setRepeat((r) => REPEAT_ORDER[(REPEAT_ORDER.indexOf(r) + 1) % REPEAT_ORDER.length]);
  }, []);

  const setVolume = useCallback((v: number) => {
    setVolumeState(Math.min(100, Math.max(0, Math.round(v))));
  }, []);

  const togglePlay = useCallback(() => setIsPlaying((p) => !p), []);

  const setTrackVideoId = useCallback((trackId: string, videoId: string) => {
    setQueue((q) =>
      q.map((t) =>
        t.id === trackId && !t.youtube_video_id ? { ...t, youtube_video_id: videoId } : t,
      ),
    );
  }, []);

  const value = useMemo<PlayerContextValue>(
    () => ({
      queue,
      currentIndex,
      current,
      isPlaying,
      shuffle,
      repeat,
      volume,
      hydrated,
      setIsPlaying,
      togglePlay,
      setShuffle,
      toggleShuffle,
      cycleRepeat,
      setVolume,
      playQueue,
      playNext,
      playPrev,
      jumpTo,
      removeFromQueue,
      clearQueue,
      setTrackVideoId,
    }),
    [
      queue,
      currentIndex,
      current,
      isPlaying,
      shuffle,
      repeat,
      volume,
      hydrated,
      togglePlay,
      toggleShuffle,
      cycleRepeat,
      setVolume,
      playQueue,
      playNext,
      playPrev,
      jumpTo,
      removeFromQueue,
      clearQueue,
      setTrackVideoId,
    ],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
}
