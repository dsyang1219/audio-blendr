import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TrackList } from "@/components/TrackList";
import { Music } from "lucide-react";
import type { Track } from "@/lib/player-context";

export const Route = createFileRoute("/_app/playlists/$id")({
  component: PlaylistDetail,
});

function PlaylistDetail() {
  const { id } = Route.useParams();
  const [playlist, setPlaylist] = useState<{ name: string; description: string | null; cover_url: string | null } | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      supabase.from("playlists").select("name, description, cover_url").eq("id", id).maybeSingle(),
      supabase.from("playlist_tracks").select("*").eq("playlist_id", id).order("position"),
    ]).then(([pl, tr]) => {
      setPlaylist(pl.data);
      setTracks((tr.data ?? []) as Track[]);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (!playlist) return <div className="p-8 text-muted-foreground">Playlist not found</div>;

  return (
    <div className="p-8">
      <div className="mb-8 flex items-end gap-6">
        <div className="h-48 w-48 overflow-hidden rounded-lg bg-muted shadow-xl">
          {playlist.cover_url ? (
            <img src={playlist.cover_url} alt={playlist.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Music className="h-20 w-20 text-muted-foreground" />
            </div>
          )}
        </div>
        <div>
          <p className="text-xs font-bold uppercase">Playlist</p>
          <h1 className="mt-2 text-5xl font-bold">{playlist.name}</h1>
          {playlist.description && <p className="mt-2 text-muted-foreground">{playlist.description}</p>}
          <p className="mt-3 text-sm text-muted-foreground">{tracks.length} {tracks.length === 1 ? "song" : "songs"}</p>
        </div>
      </div>

      {tracks.length === 0 ? (
        <p className="text-muted-foreground">No tracks in this playlist.</p>
      ) : (
        <TrackList tracks={tracks} table="playlist_tracks" />
      )}
    </div>
  );
}
