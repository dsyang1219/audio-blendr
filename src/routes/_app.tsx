import { createFileRoute, Outlet, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Artwork } from "@/components/Artwork";
import { Heart, Home, Library, LogOut, Plug, Settings, Menu } from "lucide-react";
import { Player } from "@/components/Player";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [playlists, setPlaylists] = useState<
    { id: string; name: string; cover_url: string | null }[]
  >([]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("playlists")
      .select("id, name, cover_url")
      .order("sort_order", { ascending: true })
      .order("updated_at", { ascending: false })
      .then(({ data }) => setPlaylists(data ?? []));
  }, [user, location.pathname]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  const displayName =
    (user.user_metadata?.display_name as string | undefined)?.trim() ||
    user.email?.split("@")[0] ||
    "You";

  const sidebarContent = (
    <>
      <Link to="/" className="mb-6 block px-1">
        <Logo size="md" />
      </Link>

      <nav className="space-y-1.5">
        <NavItem to="/home" icon={<Home className="h-4 w-4" />}>
          Home
        </NavItem>
        <NavItem to="/library" icon={<Heart className="h-4 w-4" />}>
          Liked Songs
        </NavItem>
        <NavItem to="/playlists" icon={<Library className="h-4 w-4" />}>
          Playlists
        </NavItem>
        <NavItem to="/connect" icon={<Plug className="h-4 w-4" />}>
          Sync
        </NavItem>
        <NavItem to="/settings" icon={<Settings className="h-4 w-4" />}>
          Settings
        </NavItem>
      </nav>

      <div className="mt-6 flex-1 min-h-0 border-t border-sidebar-border pt-4">
        <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
          Your Playlists
        </p>
        <ScrollArea className="h-full max-h-[40vh] md:max-h-[calc(100vh-26rem)]">
          <div className="space-y-0.5 pr-2">
            {playlists.length === 0 && (
              <p className="px-3 text-xs text-muted-foreground">
                Sync from Spotify to see your playlists here.
              </p>
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
                  <Artwork src={p.cover_url} iconClassName="max-h-3 max-w-3" />
                </div>
                <span className="truncate">{p.name}</span>
              </Link>
            ))}
          </div>
        </ScrollArea>
      </div>

      <div className="mt-4 pt-4">
        <Link
          to="/settings"
          className="mb-2 flex items-center gap-2 rounded-lg bg-sidebar-accent/50 px-3 py-2 transition-colors hover:bg-sidebar-accent"
        >
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            {displayName[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold">{displayName}</div>
            <div className="truncate text-[11px] text-muted-foreground">{user.email}</div>
          </div>
        </Link>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          onClick={() => signOut()}
        >
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </Button>
        <nav aria-label="Legal" className="mt-2 flex gap-3 px-3 text-[11px] text-muted-foreground">
          <Link to="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <Link to="/terms" className="hover:text-foreground">
            Terms
          </Link>
        </nav>
      </div>
    </>
  );

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-sidebar-border bg-sidebar/95 px-4 py-3 md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex w-72 flex-col bg-sidebar p-4">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            {sidebarContent}
          </SheetContent>
        </Sheet>
        <Link to="/" className="block">
          <Logo size="sm" />
        </Link>
        <div className="w-9" />
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden w-64 flex-col border-r border-sidebar-border bg-sidebar/80 p-4 backdrop-blur-xl md:flex">
          {sidebarContent}
        </aside>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      <Player />
    </div>
  );
}

function NavItem({
  to,
  icon,
  children,
}: {
  to: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
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
