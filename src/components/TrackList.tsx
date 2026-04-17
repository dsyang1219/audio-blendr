import { useEffect, useState } from "react";
import { Play, Music, Youtube, Check, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { usePlayer, type Track } from "@/lib/player-context";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TrackListProps {
  tracks: Track[];
  table: "liked_tracks" | "playlist_tracks";
  playlistId?: string;
  isCustomPlaylist?: boolean;
  onTrackRemoved?: () => void;
}

interface UserPlaylist {
  id: string;
  name: string;
}

function fmt(seconds?: number | null) {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function TrackList({ tracks, table, playlistId, isCustomPlaylist, onTrackRemoved }: TrackListProps) {
  const { playQueue, current } = usePlayer();
  const { user } = useAuth();
  const [hover, setHover] = useState<string | null>(null);
  const [userPlaylists, setUserPlaylists] = useState<UserPlaylist[]>([]);
  const queueTracks = tracks.map((t) => ({ ...t, sourceTable: t.sourceTable ?? table }));

  useEffect(() => {
    if (!user) return;
    supabase
      .from("playlists")
      .select("id, name")
      .eq("source", "custom")
      .order("name")
      .then(({ data }) => setUserPlaylists((data ?? []) as UserPlaylist[]));
  }, [user]);

  const addToPlaylist = async (track: Track, targetPlaylistId: string) => {
    if (!user) return;
    const { count } = await supabase
      .from("playlist_tracks")
      .select("id", { count: "exact", head: true })
      .eq("playlist_id", targetPlaylistId);

    const { error } = await supabase.from("playlist_tracks").insert({
      user_id: user.id,
      playlist_id: targetPlaylistId,
      title: track.title,
      artist: track.artist,
      album: track.album ?? null,
      album_art_url: track.album_art_url ?? null,
      duration_seconds: track.duration_seconds ?? null,
      youtube_video_id: track.youtube_video_id ?? null,
      spotify_track_id: track.spotify_track_id ?? null,
      source: track.spotify_track_id ? "spotify" : "youtube",
      position: count ?? 0,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Added to playlist");
    }
  };

  const removeFromPlaylist = async (trackId: string) => {
    const { error } = await supabase.from("playlist_tracks").delete().eq("id", trackId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Removed");
      onTrackRemoved?.();
    }
  };

  const removeFromLiked = async (trackId: string) => {
    const { error } = await supabase.from("liked_tracks").delete().eq("id", trackId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Removed from liked");
      onTrackRemoved?.();
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl glass">
      <div className="grid grid-cols-[3rem_1fr_1fr_4rem_2.5rem] items-center gap-4 border-b border-border/60 px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
        <span className="text-center">#</span>
        <span>Title</span>
        <span className="hidden md:block">Album</span>
        <span className="text-right">Time</span>
        <span />
      </div>
      <ul>
        {queueTracks.map((t, i) => {
          const isCurrent = current?.id === t.id;
          return (
            <li
              key={t.id}
              onMouseEnter={() => setHover(t.id)}
              onMouseLeave={() => setHover(null)}
              onDoubleClick={() => playQueue(queueTracks, i)}
              className={cn(
                "group grid cursor-pointer grid-cols-[3rem_1fr_1fr_4rem_2.5rem] items-center gap-4 border-b border-border/30 px-4 py-2.5 text-sm transition-colors last:border-b-0 hover:bg-accent/40",
                isCurrent && "bg-primary/10 text-primary"
              )}
            >
              <span className="flex justify-center text-muted-foreground">
                {hover === t.id ? (
                  <button
                    onClick={() => playQueue(queueTracks, i)}
                    className="text-foreground hover:text-primary"
                    aria-label="Play"
                  >
                    <Play className="h-4 w-4 fill-current" />
                  </button>
                ) : isCurrent ? (
                  <span className="h-2 w-2 animate-pulse rounded-full bg-primary shadow-glow" />
                ) : (
                  <span>{i + 1}</span>
                )}
              </span>
              <div className="flex min-w-0 items-center gap-3">
                <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-md bg-muted shadow-elegant">
                  {t.album_art_url ? (
                    <img src={t.album_art_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-violet">
                      <Music className="h-4 w-4 text-primary-foreground" />
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                    aria-label="More options"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <Plus className="mr-2 h-4 w-4" /> Add to playlist
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      {userPlaylists.length === 0 ? (
                        <DropdownMenuLabel className="text-xs text-muted-foreground">
                          No custom playlists yet
                        </DropdownMenuLabel>
                      ) : (
                        userPlaylists.map((pl) => (
                          <DropdownMenuItem key={pl.id} onClick={() => addToPlaylist(t, pl.id)}>
                            {pl.name}
                          </DropdownMenuItem>
                        ))
                      )}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  {table === "liked_tracks" && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => removeFromLiked(t.id)} className="text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" /> Remove from liked
                      </DropdownMenuItem>
                    </>
                  )}
                  {table === "playlist_tracks" && playlistId && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => removeFromPlaylist(t.id)} className="text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" /> Remove from playlist
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
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
