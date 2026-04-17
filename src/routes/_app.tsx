import { createFileRoute, Outlet, redirect, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Music, Heart, Library, LogOut, Plug } from "lucide-react";
import { Player } from "@/components/Player";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [playlists, setPlaylists] = useState<{ id: string; name: string; cover_url: string | null }[]>([]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("playlists")
      .select("id, name, cover_url")
      .order("updated_at", { ascending: false })
      .then(({ data }) => setPlaylists(data ?? []));
  }, [user, location.pathname]);

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden w-64 flex-col border-r border-sidebar-border bg-sidebar p-4 md:flex">
          <Link to="/" className="mb-6 flex items-center gap-2">
            <Music className="h-6 w-6 text-primary" />
            <span className="font-bold">Audio Blendr</span>
          </Link>

          <nav className="space-y-1">
            <NavItem to="/library" icon={<Heart className="h-4 w-4" />}>Liked Songs</NavItem>
            <NavItem to="/playlists" icon={<Library className="h-4 w-4" />}>Playlists</NavItem>
            <NavItem to="/connect" icon={<Plug className="h-4 w-4" />}>Spotify Sync</NavItem>
          </nav>

          <div className="mt-6 border-t border-sidebar-border pt-4">
            <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your Playlists</p>
            <ScrollArea className="h-[calc(100vh-26rem)]">
              <div className="space-y-1">
                {playlists.length === 0 && (
                  <p className="px-2 text-xs text-muted-foreground">Sync from Spotify to see your playlists here.</p>
                )}
                {playlists.map((p) => (
                  <Link
                    key={p.id}
                    to="/playlists/$id"
                    params={{ id: p.id }}
                    className="block truncate rounded px-2 py-1 text-sm text-sidebar-foreground hover:bg-sidebar-accent"
                  >
                    {p.name}
                  </Link>
                ))}
              </div>
            </ScrollArea>
          </div>

          <div className="mt-auto pt-4">
            <div className="mb-2 truncate px-2 text-xs text-muted-foreground">{user.email}</div>
            <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => signOut()}>
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </Button>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      <Player />
    </div>
  );
}

function NavItem({ to, icon, children }: { to: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
      className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent"
    >
      {icon}
      {children}
    </Link>
  );
}

// satisfy redirect import (used by future guard expansions)
void redirect;
