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
}

interface PlayerContextValue {
  queue: Track[];
  currentIndex: number;
  current: Track | null;
  isPlaying: boolean;
  setIsPlaying: (v: boolean) => void;
  playQueue: (tracks: Track[], startIndex?: number) => void;
  playNext: () => void;
  playPrev: () => void;
}

const PlayerContext = createContext<PlayerContextValue | undefined>(undefined);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);

  const current = currentIndex >= 0 && currentIndex < queue.length ? queue[currentIndex] : null;

  const playQueue = (tracks: Track[], startIndex = 0) => {
    setQueue(tracks);
    setCurrentIndex(startIndex);
    setIsPlaying(true);
  };

  const playNext = () => {
    setCurrentIndex((i) => (i + 1 < queue.length ? i + 1 : i));
  };

  const playPrev = () => {
    setCurrentIndex((i) => (i > 0 ? i - 1 : i));
  };

  return (
    <PlayerContext.Provider value={{ queue, currentIndex, current, isPlaying, setIsPlaying, playQueue, playNext, playPrev }}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
}
