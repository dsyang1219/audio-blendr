import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { TrackList } from "@/components/TrackList";
import { Music, Trash2, Play, Shuffle, RefreshCw } from "lucide-react";
import type { Track } from "@/lib/player-context";
import { usePlayer } from "@/lib/player-context";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { AddSongDialog } from "@/components/AddSongDialog";
import { syncSinglePlaylist } from "@/utils/spotify.functions";

export const Route = createFileRoute("/_app/playlists/$id")({
  component: PlaylistDetail,
});

interface PlaylistMeta {
  name: string;
  description: string | null;
  cover_url: string | null;
  source: string;
  user_id: string;
  spotify_playlist_id: string | null;
}

function PlaylistDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { playQueue } = usePlayer();
  const [playlist, setPlaylist] = useState<PlaylistMeta | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const syncOneFn = useServerFn(syncSinglePlaylist);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      supabase.from("playlists").select("name, description, cover_url, source, user_id, spotify_playlist_id").eq("id", id).maybeSingle(),
      supabase.from("playlist_tracks").select("*").eq("playlist_id", id).order("position"),
    ]).then(([pl, tr]) => {
      setPlaylist(pl.data as PlaylistMeta | null);
      setTracks((tr.data ?? []) as Track[]);
      setLoading(false);
    });
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const queueTracks = tracks.map((t) => ({ ...t, sourceTable: "playlist_tracks" as const }));

  const handlePlayAll = () => {
    if (queueTracks.length === 0) return;
    playQueue(queueTracks, 0, { shuffle: false });
  };

  const handleShuffle = () => {
    if (queueTracks.length === 0) return;
    playQueue(queueTracks, 0, { shuffle: true });
  };

  const handleSyncFromSpotify = async () => {
    setSyncing(true);
    try {
      const r = await syncOneFn({ data: { playlistId: id } });
      toast.success(`Imported ${r.tracks} tracks from Spotify`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to sync");
    } finally {
      setSyncing(false);
    }
  };

  const deletePlaylist = async () => {
    const { error: tracksError } = await supabase.from("playlist_tracks").delete().eq("playlist_id", id);
    if (tracksError) {
      toast.error(tracksError.message);
      return;
    }
    const { error } = await supabase.from("playlists").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Playlist deleted");
    navigate({ to: "/playlists" });
  };

  if (loading) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (!playlist) return <div className="p-8 text-muted-foreground">Playlist not found</div>;

  const isCustom = playlist.source === "custom";
  const isSpotifyLinked = playlist.source === "spotify" && !!playlist.spotify_playlist_id;

  return (
    <div className="p-8">
      <div className="mb-6 flex items-end gap-6">
        <div className="h-48 w-48 overflow-hidden rounded-lg bg-muted shadow-xl">
          {playlist.cover_url ? (
            <img src={playlist.cover_url} alt={playlist.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Music className="h-20 w-20 text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="flex-1">
          <p className="text-xs font-bold uppercase">
            {isCustom ? "Custom Playlist" : playlist.source === "youtube" ? "YouTube Playlist" : "Spotify Playlist"}
          </p>
          <h1 className="mt-2 text-5xl font-bold">{playlist.name}</h1>
          {playlist.description && <p className="mt-2 text-muted-foreground">{playlist.description}</p>}
          <p className="mt-3 text-sm text-muted-foreground">
            {tracks.length} {tracks.length === 1 ? "song" : "songs"}
          </p>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Button onClick={handlePlayAll} disabled={tracks.length === 0} size="lg" className="gap-2">
          <Play className="h-5 w-5 fill-current" /> Play
        </Button>
        <Button onClick={handleShuffle} disabled={tracks.length === 0} size="lg" variant="secondary" className="gap-2">
          <Shuffle className="h-5 w-5" /> Shuffle
        </Button>
        <AddSongDialog playlistId={id} onAdded={load} />
        {isSpotifyLinked && (
          <Button onClick={handleSyncFromSpotify} disabled={syncing} size="lg" variant="outline" className="gap-2">
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            {tracks.length === 0 ? "Sync from Spotify" : "Re-sync from Spotify"}
          </Button>
        )}
        {isCustom && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="lg" className="gap-2">
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this playlist?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently remove "{playlist.name}" and all of its tracks. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={deletePlaylist}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {tracks.length === 0 ? (
        <p className="text-muted-foreground">
          {isSpotifyLinked
            ? 'No tracks yet. Click "Sync from Spotify" above to import this playlist\'s tracks.'
            : 'No tracks yet. Click "Add song" above to add from Spotify or YouTube.'}
        </p>
      ) : (
        <TrackList
          tracks={tracks}
          table="playlist_tracks"
          playlistId={id}
          isCustomPlaylist={isCustom}
          onTrackRemoved={load}
        />
      )}
    </div>
  );
}
