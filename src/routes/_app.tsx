import { createFileRoute, Outlet, redirect, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Music, Heart, Library, LogOut, Plug, Settings, Menu } from "lucide-react";
import { Player } from "@/components/Player";
import { Logo } from "@/components/Logo";

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
        <aside className="hidden w-64 flex-col border-r border-sidebar-border bg-sidebar/80 backdrop-blur-xl p-4 md:flex">
          <Link to="/" className="mb-6 block px-1">
            <Logo size="md" />
          </Link>

          <nav className="space-y-1.5">
            <NavItem to="/library" icon={<Heart className="h-4 w-4" />}>Liked Songs</NavItem>
            <NavItem to="/playlists" icon={<Library className="h-4 w-4" />}>Playlists</NavItem>
            <NavItem to="/connect" icon={<Plug className="h-4 w-4" />}>Spotify and Youtube Sync</NavItem>
            <NavItem to="/settings" icon={<Settings className="h-4 w-4" />}>Settings</NavItem>
          </nav>

          <div className="mt-6 border-t border-sidebar-border pt-4">
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Your Playlists</p>
            <ScrollArea className="h-[calc(100vh-26rem)]">
              <div className="space-y-0.5 pr-2">
                {playlists.length === 0 && (
                  <p className="px-3 text-xs text-muted-foreground">Sync from Spotify to see your playlists here.</p>
                )}
                {playlists.map((p) => (
                  <Link
                    key={p.id}
                    to="/playlists/$id"
                    params={{ id: p.id }}
                    activeProps={{ className: "bg-sidebar-accent text-foreground" }}
                    className="flex items-center gap-2 truncate rounded-lg px-3 py-1.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
                  >
                    <div className="h-6 w-6 flex-shrink-0 overflow-hidden rounded bg-muted">
                      {p.cover_url ? (
                        <img src={p.cover_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-secondary">
                          <Music className="h-3 w-3 text-secondary-foreground" />
                        </div>
                      )}
                    </div>
                    <span className="truncate">{p.name}</span>
                  </Link>
                ))}
              </div>
            </ScrollArea>
          </div>

          <div className="mt-auto pt-4">
            <div className="mb-2 flex items-center gap-2 rounded-lg bg-sidebar-accent/50 px-3 py-2">
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">
                {(user.email?.[0] ?? "U").toUpperCase()}
              </div>
              <span className="truncate text-xs text-muted-foreground">{user.email}</span>
            </div>
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
      activeProps={{ className: "bg-secondary text-secondary-foreground" }}
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground transition-all hover:bg-sidebar-accent hover:text-foreground"
    >
      {icon}
      {children}
    </Link>
  );
}

// satisfy redirect import (used by future guard expansions)
void redirect;
