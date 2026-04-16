import { useState } from "react";
import { Play, Music, Youtube, Check } from "lucide-react";
import { usePlayer, type Track } from "@/lib/player-context";
import { cn } from "@/lib/utils";

interface TrackListProps {
  tracks: Track[];
  table: "liked_tracks" | "playlist_tracks";
}

function fmt(seconds?: number | null) {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function TrackList({ tracks }: TrackListProps) {
  const { playQueue, current } = usePlayer();
  const [hover, setHover] = useState<string | null>(null);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card/40">
      <div className="grid grid-cols-[3rem_1fr_1fr_4rem] items-center gap-4 border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <span className="text-center">#</span>
        <span>Title</span>
        <span className="hidden md:block">Album</span>
        <span className="text-right">Time</span>
      </div>
      <ul>
        {tracks.map((t, i) => {
          const isCurrent = current?.id === t.id;
          return (
            <li
              key={t.id}
              onMouseEnter={() => setHover(t.id)}
              onMouseLeave={() => setHover(null)}
              onDoubleClick={() => playQueue(tracks, i)}
              className={cn(
                "grid cursor-pointer grid-cols-[3rem_1fr_1fr_4rem] items-center gap-4 px-4 py-2 text-sm hover:bg-accent/40",
                isCurrent && "text-primary"
              )}
            >
              <span className="flex justify-center text-muted-foreground">
                {hover === t.id ? (
                  <button
                    onClick={() => playQueue(tracks, i)}
                    className="text-foreground hover:text-primary"
                    aria-label="Play"
                  >
                    <Play className="h-4 w-4 fill-current" />
                  </button>
                ) : isCurrent ? (
                  <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                ) : (
                  <span>{i + 1}</span>
                )}
              </span>
              <div className="flex min-w-0 items-center gap-3">
                <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded bg-muted">
                  {t.album_art_url ? (
                    <img src={t.album_art_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Music className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{t.title}</span>
                    <SourceBadge track={t} />
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{t.artist}</div>
                </div>
              </div>
              <span className="hidden truncate text-muted-foreground md:block">{t.album ?? "—"}</span>
              <span className="text-right text-muted-foreground">{fmt(t.duration_seconds)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SourceBadge({ track }: { track: Track & { source?: string } }) {
  const source = (track as Track & { source?: string }).source ?? (track.spotify_track_id ? "spotify" : "youtube");
  if (source === "youtube") {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-red-400">
        <Youtube className="h-2.5 w-2.5" /> YT
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
      <Check className="h-2.5 w-2.5" /> Spotify
    </span>
  );
}
