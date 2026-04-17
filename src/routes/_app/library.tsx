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
    <div className="animate-fade-in">
      <div className="relative bg-secondary px-8 pb-10 pt-16">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background" />
        <div className="relative flex flex-col items-start gap-6 md:flex-row md:items-end">
          <div className="flex h-52 w-52 items-center justify-center rounded-2xl bg-background/20 backdrop-blur-sm shadow-elegant ring-1 ring-white/10">
            <Heart className="h-24 w-24 fill-primary-foreground text-primary-foreground drop-shadow-lg" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary-foreground/90">Playlist</p>
            <h1 className="mt-2 text-5xl font-bold tracking-tight md:text-6xl">Liked Songs</h1>
            <p className="mt-4 text-sm font-medium text-primary-foreground/90">
              {tracks.length} {tracks.length === 1 ? "song" : "songs"}
            </p>
          </div>
        </div>
      </div>

      <div className="px-8 pb-8 pt-2">
        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : tracks.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary">
              <Heart className="h-8 w-8 fill-primary-foreground text-primary-foreground" />
            </div>
            <p className="text-lg font-semibold">No liked songs yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Connect Spotify and sync your library to get started.</p>
          </div>
        ) : (
          <TrackList tracks={tracks} table="liked_tracks" />
        )}
      </div>
    </div>
  );
}
