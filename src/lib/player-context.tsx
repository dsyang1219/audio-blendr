import { createContext, useContext, useState, type ReactNode } from "react";

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

interface PlayerContextValue {
  queue: Track[];
  currentIndex: number;
  current: Track | null;
  isPlaying: boolean;
  shuffle: boolean;
  setIsPlaying: (v: boolean) => void;
  setShuffle: (v: boolean) => void;
  toggleShuffle: () => void;
  playQueue: (tracks: Track[], startIndex?: number, opts?: { shuffle?: boolean }) => void;
  playNext: () => void;
  playPrev: () => void;
  setTrackVideoId: (trackId: string, videoId: string) => void;
}

const PlayerContext = createContext<PlayerContextValue | undefined>(undefined);

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [shuffle, setShuffle] = useState(false);

  const current = currentIndex >= 0 && currentIndex < queue.length ? queue[currentIndex] : null;

  const playQueue = (tracks: Track[], startIndex = 0, opts?: { shuffle?: boolean }) => {
    const useShuffle = opts?.shuffle ?? false;
    if (useShuffle) {
      // Fully randomize — pick a random starting track too
      const shuffled = shuffleArray(tracks);
      setQueue(shuffled);
      setCurrentIndex(0);
      setShuffle(true);
    } else {
      setQueue(tracks);
      setCurrentIndex(startIndex);
    }
    setIsPlaying(true);
  };

  const playNext = () => {
    setCurrentIndex((i) => (i + 1 < queue.length ? i + 1 : i));
  };

  const playPrev = () => {
    setCurrentIndex((i) => (i > 0 ? i - 1 : i));
  };

  const toggleShuffle = () => {
    setShuffle((prev) => {
      const next = !prev;
      if (next && queue.length > 1) {
        // Reshuffle upcoming tracks. If something is playing, keep it as current.
        if (currentIndex >= 0) {
          const currentTrack = queue[currentIndex];
          const rest = queue.filter((_, i) => i !== currentIndex);
          const shuffled = shuffleArray(rest);
          setQueue([currentTrack, ...shuffled]);
          setCurrentIndex(0);
        } else {
          setQueue((q) => shuffleArray(q));
        }
      }
      return next;
    });
  };

  const setTrackVideoId = (trackId: string, videoId: string) => {
    setQueue((q) =>
      q.map((t) =>
        t.id === trackId && !t.youtube_video_id ? { ...t, youtube_video_id: videoId } : t,
      ),
    );
  };

  return (
    <PlayerContext.Provider
      value={{
        queue,
        currentIndex,
        current,
        isPlaying,
        shuffle,
        setIsPlaying,
        setShuffle,
        toggleShuffle,
        playQueue,
        playNext,
        playPrev,
        setTrackVideoId,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
}
