import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Music } from "lucide-react";

export const Route = createFileRoute("/_app/playlists")({
  component: PlaylistsIndex,
});

interface PL { id: string; name: string; description: string | null; cover_url: string | null }

function PlaylistsIndex() {
  const [playlists, setPlaylists] = useState<PL[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("playlists")
      .select("id, name, description, cover_url")
      .order("name")
      .then(({ data }) => {
        setPlaylists((data ?? []) as PL[]);
        setLoading(false);
      });
  }, []);

  return (
    <div className="p-8">
      <h1 className="mb-6 text-3xl font-bold">Your Playlists</h1>
      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : playlists.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">No playlists yet. Sync from Spotify on the Connect page.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {playlists.map((p) => (
            <Link
              key={p.id}
              to="/playlists/$id"
              params={{ id: p.id }}
              className="group rounded-lg bg-card p-4 transition hover:bg-accent"
            >
              <div className="mb-3 aspect-square overflow-hidden rounded bg-muted">
                {p.cover_url ? (
                  <img src={p.cover_url} alt={p.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Music className="h-10 w-10 text-muted-foreground" />
                  </div>
                )}
              </div>
              <h3 className="truncate font-semibold">{p.name}</h3>
              {p.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{p.description}</p>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
