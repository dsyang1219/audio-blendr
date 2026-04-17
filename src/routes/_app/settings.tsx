import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth-context";
import { getSpotifyStatus, disconnectSpotify } from "@/utils/spotify.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Settings as SettingsIcon, LogOut, User, Plug, Unplug, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const getStatusFn = useServerFn(getSpotifyStatus);
  const disconnectFn = useServerFn(disconnectSpotify);

  const [status, setStatus] = useState<{ connected: boolean; displayName: string | null } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    getStatusFn()
      .then(setStatus)
      .catch(() => setStatus({ connected: false, displayName: null }));
  }, [getStatusFn]);

  const handleSignOut = async () => {
    setBusy("signout");
    try {
      await signOut();
      toast.success("Signed out");
      navigate({ to: "/auth" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to sign out");
    } finally {
      setBusy(null);
    }
  };

  const handleDisconnect = async () => {
    setBusy("disconnect");
    try {
      await disconnectFn();
      setStatus({ connected: false, displayName: null });
      toast.success("Disconnected from Spotify");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to disconnect");
    } finally {
      setBusy(null);
    }
  };

  const initial = (user?.email?.[0] ?? "U").toUpperCase();

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-8 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
          <SettingsIcon className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight">
            <span className="text-gradient">Settings</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your account and connected services.</p>
        </div>
      </div>

      {/* Account */}
      <Card className="glass border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-violet shadow-glow">
              <User className="h-5 w-5 text-primary-foreground" />
            </div>
            Account
          </CardTitle>
          <CardDescription>Your signed-in identity.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 rounded-xl bg-sidebar-accent/40 p-3">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gradient-primary text-base font-bold text-primary-foreground shadow-glow">
              {initial}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user?.email ?? "—"}</p>
              <p className="font-mono text-[11px] text-muted-foreground">ID: {user?.id?.slice(0, 8) ?? "—"}…</p>
            </div>
          </div>
          <Separator />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={handleSignOut} disabled={busy === "signout"}>
              {busy === "signout" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="mr-2 h-4 w-4" />
              )}
              Sign out
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Connections */}
      <Card className="glass border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-primary shadow-glow">
              <Plug className="h-5 w-5 text-primary-foreground" />
            </div>
            Connections
          </CardTitle>
          <CardDescription>Third-party services linked to your account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-border/60 bg-sidebar-accent/30 p-3">
            <div>
              <p className="text-sm font-medium">Spotify</p>
              <p className="text-xs text-muted-foreground">
                {status === null
                  ? "Checking…"
                  : status.connected
                    ? `Connected as ${status.displayName ?? "Spotify user"}`
                    : "Not connected"}
              </p>
            </div>
            {status?.connected ? (
              <Button variant="ghost" size="sm" onClick={handleDisconnect} disabled={busy === "disconnect"}>
                {busy === "disconnect" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Unplug className="mr-2 h-4 w-4" />
                )}
                Disconnect
              </Button>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => navigate({ to: "/connect" })}>
                <Plug className="mr-2 h-4 w-4" /> Connect
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="glass border-destructive/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/20 text-destructive">
              <ShieldAlert className="h-5 w-5" />
            </div>
            Danger zone
          </CardTitle>
          <CardDescription>Irreversible actions. Proceed with care.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            To wipe your library or delete your account, contact support.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
