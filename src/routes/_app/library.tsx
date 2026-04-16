import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TrackList } from "@/components/TrackList";
import { Heart } from "lucide-react";
import type { Track } from "@/lib/player-context";

export const Route = createFileRoute("/_app/library")({
  component: LibraryPage,
});

function LibraryPage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("liked_tracks")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setTracks((data ?? []) as Track[]);
        setLoading(false);
      });
  }, []);

  return (
    <div className="p-8">
      <div className="mb-8 flex items-end gap-6">
        <div className="flex h-48 w-48 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/40 shadow-xl">
          <Heart className="h-20 w-20 fill-primary-foreground text-primary-foreground" />
        </div>
        <div>
          <p className="text-xs font-bold uppercase">Playlist</p>
          <h1 className="mt-2 text-5xl font-bold">Liked Songs</h1>
          <p className="mt-3 text-sm text-muted-foreground">{tracks.length} {tracks.length === 1 ? "song" : "songs"}</p>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : tracks.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">No liked songs yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">Connect Spotify and sync your library to get started.</p>
        </div>
      ) : (
        <TrackList tracks={tracks} table="liked_tracks" />
      )}
    </div>
  );
}
