import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getSpotifyAuthUrl,
  getSpotifyStatus,
  syncLikedSongs,
  syncPlaylists,
  disconnectSpotify,
} from "@/utils/spotify.functions";
import { importYouTubePlaylist, addYouTubeVideo } from "@/utils/youtube-import.functions";
import { batchResolveYouTube } from "@/utils/youtube.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Music, Youtube, Loader2, Plug, Unplug } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/connect")({
  component: ConnectPage,
});

function ConnectPage() {
  const [status, setStatus] = useState<{ connected: boolean; displayName: string | null } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [ytUrl, setYtUrl] = useState("");
  const [ytPlaylistUrl, setYtPlaylistUrl] = useState("");
  const [ytPlaylistName, setYtPlaylistName] = useState("");

  const getAuthUrlFn = useServerFn(getSpotifyAuthUrl);
  const getStatusFn = useServerFn(getSpotifyStatus);
  const syncLikedFn = useServerFn(syncLikedSongs);
  const syncPlaylistsFn = useServerFn(syncPlaylists);
  const disconnectFn = useServerFn(disconnectSpotify);
  const importPlaylistFn = useServerFn(importYouTubePlaylist);
  const addVideoFn = useServerFn(addYouTubeVideo);

  useEffect(() => {
    getStatusFn().then(setStatus).catch(() => setStatus({ connected: false, displayName: null }));
  }, [getStatusFn]);

  const openSpotifyAuth = (url: string) => {
    if (window.top && window.top !== window) {
      try {
        window.top.location.href = url;
        return;
      } catch {
        // Fall back to a new tab when the preview frame cannot navigate the top window.
      }
    }

    const popup = window.open(url, "_blank", "noopener,noreferrer");
    if (!popup) {
      window.location.href = url;
    }
  };

  const connect = async () => {
    setBusy("connect");
    try {
      const { url } = await getAuthUrlFn({ data: { origin: window.location.origin } });
      openSpotifyAuth(url);
      setBusy(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start Spotify auth");
      setBusy(null);
    }
  };

  const disconnect = async () => {
    setBusy("disconnect");
    await disconnectFn();
    setStatus({ connected: false, displayName: null });
    toast.success("Disconnected from Spotify");
    setBusy(null);
  };

  const syncLiked = async () => {
    setBusy("liked");
    try {
      const r = await syncLikedFn();
      toast.success(`Synced ${r.count} liked songs`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to sync");
    }
    setBusy(null);
  };

  const syncAll = async () => {
    setBusy("playlists");
    try {
      const r = (await syncPlaylistsFn()) as {
        playlists: number;
        tracks: number;
        skipped?: number;
        remaining?: number;
        partial?: boolean;
        message?: string | null;
      };
      if (r.message) {
        if (r.partial) toast.warning(r.message);
        else toast.success(r.message);
      } else {
        const skippedNote = r.skipped ? ` (skipped ${r.skipped} already-synced)` : "";
        toast.success(`Synced ${r.playlists} new playlists, ${r.tracks} tracks${skippedNote}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to sync");
    }
    setBusy(null);
  };

  const addVideo = async () => {
    if (!ytUrl.trim()) return;
    setBusy("video");
    try {
      const r = await addVideoFn({ data: { url: ytUrl } });
      toast.success(`Added "${r.title}" to Liked Songs`);
      setYtUrl("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add video");
    }
    setBusy(null);
  };

  const importPlaylist = async () => {
    if (!ytPlaylistUrl.trim()) return;
    setBusy("ytplaylist");
    try {
      const r = await importPlaylistFn({ data: { url: ytPlaylistUrl, name: ytPlaylistName || undefined } });
      toast.success(`Imported "${r.name}" with ${r.tracks} tracks`);
      setYtPlaylistUrl("");
      setYtPlaylistName("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to import playlist");
    }
    setBusy(null);
  };

  return (
    <div className="space-y-6 p-8 animate-fade-in">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Sync sources</h1>
        <p className="mt-1 text-muted-foreground">Connect Spotify and add YouTube tracks to build your unified library.</p>
      </div>

      {/* Spotify */}
      <Card className="glass border-border/60 hover-lift">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
              <Music className="h-5 w-5 text-secondary-foreground" />
            </div>
            Spotify
          </CardTitle>
          <CardDescription>
            {status?.connected
              ? `Connected as ${status.displayName ?? "Spotify user"}.`
              : "Sync your liked songs and playlists from Spotify."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!status ? (
            <p className="text-sm text-muted-foreground">Checking…</p>
          ) : !status.connected ? (
            <Button onClick={connect} disabled={busy === "connect"}>
              {busy === "connect" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plug className="mr-2 h-4 w-4" />}
              Connect Spotify
            </Button>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button onClick={syncLiked} disabled={!!busy}>
                {busy === "liked" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sync liked songs
              </Button>
              <Button onClick={syncAll} disabled={!!busy} variant="secondary">
                {busy === "playlists" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sync playlists
              </Button>
              <Button onClick={disconnect} disabled={!!busy} variant="ghost">
                <Unplug className="mr-2 h-4 w-4" /> Disconnect
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* YouTube single video */}
      <Card className="glass border-border/60 hover-lift">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
              <Youtube className="h-5 w-5 text-secondary-foreground" />
            </div>
            Add a YouTube video
          </CardTitle>
          <CardDescription>Paste a YouTube link to add it as a liked song.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="https://www.youtube.com/watch?v=…"
              value={ytUrl}
              onChange={(e) => setYtUrl(e.target.value)}
            />
            <Button onClick={addVideo} disabled={busy === "video" || !ytUrl.trim()}>
              {busy === "video" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* YouTube playlist */}
      <Card className="glass border-border/60 hover-lift">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
              <Youtube className="h-5 w-5 text-secondary-foreground" />
            </div>
            Import a YouTube playlist
          </CardTitle>
          <CardDescription>Paste a YouTube playlist URL to import it as an Audio Blendr playlist.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Custom playlist name (optional)"
            value={ytPlaylistName}
            onChange={(e) => setYtPlaylistName(e.target.value)}
          />
          <div className="flex gap-2">
            <Input
              placeholder="https://www.youtube.com/playlist?list=…"
              value={ytPlaylistUrl}
              onChange={(e) => setYtPlaylistUrl(e.target.value)}
            />
            <Button onClick={importPlaylist} disabled={busy === "ytplaylist" || !ytPlaylistUrl.trim()}>
              {busy === "ytplaylist" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Import
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="text-sm text-muted-foreground">
        Once synced, head to <Link to="/library" className="text-primary underline">your library</Link>.
      </div>
    </div>
  );
}
