import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TrackList } from "@/components/TrackList";
import { Heart, Play, Shuffle } from "lucide-react";
import type { Track } from "@/lib/player-context";
import { usePlayer } from "@/lib/player-context";
import { Button } from "@/components/ui/button";
import { AddSongDialog } from "@/components/AddSongDialog";

export const Route = createFileRoute("/_app/library")({
  component: LibraryPage,
});

function LibraryPage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const { playQueue } = usePlayer();

  const load = useCallback(() => {
    setLoading(true);
    supabase
      .from("liked_tracks")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setTracks((data ?? []) as Track[]);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const queueTracks = tracks.map((t) => ({ ...t, sourceTable: "liked_tracks" as const }));

  const handlePlayAll = () => {
    if (queueTracks.length === 0) return;
    playQueue(queueTracks, 0, { shuffle: false });
  };

  const handleShuffle = () => {
    if (queueTracks.length === 0) return;
    playQueue(queueTracks, 0, { shuffle: true });
  };

  return (
    <div className="animate-fade-in">
      <div className="relative bg-secondary px-4 pb-10 pt-12 md:px-8 md:pt-16">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background" />
        <div className="relative flex flex-col items-start gap-6 md:flex-row md:items-end">
          <div className="flex h-40 w-40 md:h-52 md:w-52 items-center justify-center rounded-2xl bg-background/20 backdrop-blur-sm shadow-elegant ring-1 ring-white/10">
            <Heart className="h-20 w-20 md:h-24 md:w-24 fill-primary-foreground text-primary-foreground drop-shadow-lg" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary-foreground/90">Playlist</p>
            <h1 className="mt-2 text-4xl md:text-6xl font-bold tracking-tight">Liked Songs</h1>
            <p className="mt-4 text-sm font-medium text-primary-foreground/90">
              {tracks.length} {tracks.length === 1 ? "song" : "songs"}
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 pb-8 pt-2 md:px-8">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Button onClick={handlePlayAll} disabled={tracks.length === 0} size="lg" className="gap-2 shadow-glow hover:scale-105 transition-all">
            <Play className="h-5 w-5 fill-current" /> Play
          </Button>
          <Button onClick={handleShuffle} disabled={tracks.length === 0} size="lg" variant="secondary" className="gap-2">
            <Shuffle className="h-5 w-5" /> Shuffle
          </Button>
          <AddSongDialog onAdded={load} />
        </div>

        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : tracks.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary">
              <Heart className="h-8 w-8 fill-primary-foreground text-primary-foreground" />
            </div>
            <p className="text-lg font-semibold">No liked songs yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Connect Spotify and sync your library, or click "Add song" above.</p>
          </div>
        ) : (
          <TrackList tracks={queueTracks} table="liked_tracks" onTrackRemoved={load} />
        )}
      </div>
    </div>
  );
}
