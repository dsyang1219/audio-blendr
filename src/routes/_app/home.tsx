import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Heart, History, Library, Play, Plug, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { usePlayer, type Track } from "@/lib/player-context";
import { Artwork } from "@/components/Artwork";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/home")({
  component: HomePage,
});

interface PlaylistCard {
  id: string;
  name: string;
  cover_url: string | null;
  source: string;
}

interface HistoryRow {
  id: string;
  title: string;
  artist: string;
  album_art_url: string | null;
  spotify_track_id: string | null;
  youtube_video_id: string | null;
  played_at: string;
}

function greeting(hour: number) {
  if (hour < 5) return "Up late";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function HomePage() {
  const { user } = useAuth();
  const { playQueue, current, isPlaying } = usePlayer();
  const [recent, setRecent] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistCard[]>([]);
  const [likedCount, setLikedCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let active = true;
    Promise.all([
      supabase
        .from("play_history")
        .select("id, title, artist, album_art_url, spotify_track_id, youtube_video_id, played_at")
        .order("played_at", { ascending: false })
        .limit(60),
      supabase
        .from("playlists")
        .select("id, name, cover_url, source")
        .order("sort_order", { ascending: true })
        .order("updated_at", { ascending: false })
        .limit(8),
      supabase.from("liked_tracks").select("id", { count: "exact", head: true }),
    ]).then(([history, pls, liked]) => {
      if (!active) return;
      // Collapse repeat listens of the same song down to the most recent one.
      const seen = new Set<string>();
      const unique: Track[] = [];
      for (const row of (history.data ?? []) as HistoryRow[]) {
        const key = `${row.title.toLowerCase()}|${row.artist.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push({
          id: `history-${row.id}`,
          title: row.title,
          artist: row.artist,
          album_art_url: row.album_art_url,
          spotify_track_id: row.spotify_track_id,
          youtube_video_id: row.youtube_video_id,
          sourceTable: "liked_tracks",
        });
        if (unique.length === 12) break;
      }
      setRecent(unique);
      setPlaylists((pls.data ?? []) as PlaylistCard[]);
      setLikedCount(liked.count ?? 0);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [user]);

  const name = useMemo(() => {
    const meta = (user?.user_metadata?.display_name as string | undefined)?.trim();
    return meta || user?.email?.split("@")[0] || "there";
  }, [user]);

  const hour = new Date().getHours();

  return (
    <div className="animate-fade-in px-4 py-8 md:px-8 md:py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
          {greeting(hour)}, {name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {likedCount === null
            ? "Loading your library…"
            : likedCount === 0
              ? "Your library is empty — connect Spotify or add a song to get started."
              : `${likedCount} liked ${likedCount === 1 ? "song" : "songs"} ready to play.`}
        </p>
      </header>

      {/* Quick actions */}
      <section className="mb-10 grid gap-3 sm:grid-cols-3">
        <QuickCard
          to="/library"
          icon={<Heart className="h-5 w-5 fill-current" />}
          title="Liked Songs"
          subtitle={likedCount === null ? "…" : `${likedCount} songs`}
          accent
        />
        <QuickCard
          to="/playlists"
          icon={<Plus className="h-5 w-5" />}
          title="New playlist"
          subtitle="Build your own mix"
        />
        <QuickCard
          to="/connect"
          icon={<Plug className="h-5 w-5" />}
          title="Sync"
          subtitle="Spotify & YouTube"
        />
      </section>

      {/* Recently played */}
      <section className="mb-10">
        <div className="mb-3 flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Recently played</h2>
        </div>
        {loading ? (
          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="w-36 flex-shrink-0 space-y-2">
                <Skeleton className="aspect-square w-full rounded-xl" />
                <Skeleton className="h-3.5 w-[80%]" />
                <Skeleton className="h-3 w-[55%]" />
              </div>
            ))}
          </div>
        ) : recent.length === 0 ? (
          <p className="glass rounded-2xl p-6 text-sm text-muted-foreground">
            Play something and it'll show up here.
          </p>
        ) : (
          <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 md:-mx-8 md:px-8">
            {recent.map((t, i) => {
              const active = current?.title === t.title && current?.artist === t.artist;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => playQueue(recent, i)}
                  className="group w-36 flex-shrink-0 text-left"
                >
                  <div className="relative mb-2 aspect-square w-full overflow-hidden rounded-xl bg-muted shadow-elegant ring-1 ring-white/10">
                    <Artwork src={t.album_art_url} iconClassName="max-h-10 max-w-10" />
                    <span
                      className={cn(
                        "absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-background shadow-glow transition-all",
                        active && isPlaying
                          ? "opacity-100"
                          : "translate-y-1 opacity-0 group-hover:translate-y-0 group-hover:opacity-100",
                      )}
                    >
                      <Play className="h-4 w-4 fill-current" />
                    </span>
                  </div>
                  <div className={cn("truncate text-sm font-medium", active && "text-primary")}>
                    {t.title}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{t.artist}</div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Playlists */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Library className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Your playlists</h2>
          </div>
          <Link to="/playlists" className="text-xs text-muted-foreground hover:text-foreground">
            See all
          </Link>
        </div>
        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : playlists.length === 0 ? (
          <p className="glass rounded-2xl p-6 text-sm text-muted-foreground">
            No playlists yet.{" "}
            <Link to="/playlists" className="underline underline-offset-4 hover:text-foreground">
              Create one
            </Link>{" "}
            or sync from Spotify.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {playlists.map((p) => (
              <Link
                key={p.id}
                to="/playlists/$id"
                params={{ id: p.id }}
                className="glass hover-lift flex items-center gap-3 overflow-hidden rounded-xl p-2 pr-3"
              >
                <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
                  <Artwork src={p.cover_url} />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{p.name}</div>
                  <div className="truncate text-[11px] uppercase tracking-wider text-muted-foreground">
                    {p.source}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function QuickCard({
  to,
  icon,
  title,
  subtitle,
  accent,
}: {
  to: "/library" | "/playlists" | "/connect";
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  accent?: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "glass hover-lift flex items-center gap-4 rounded-2xl p-4",
        accent && "ring-1 ring-primary/30",
      )}
    >
      <div
        className={cn(
          "flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl",
          accent ? "bg-primary text-primary-foreground shadow-glow" : "bg-secondary",
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="font-semibold">{title}</div>
        <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
      </div>
    </Link>
  );
}
