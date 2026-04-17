import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { TrackList } from "@/components/TrackList";
import { Music, Trash2, Play, Shuffle, RefreshCw, Pencil, Upload, X } from "lucide-react";
import type { Track } from "@/lib/player-context";
import { usePlayer } from "@/lib/player-context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth-context";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { AddSongDialog } from "@/components/AddSongDialog";
import { syncSinglePlaylist } from "@/utils/spotify.functions";

export const Route = createFileRoute("/_app/playlists/$id")({
  component: PlaylistDetail,
});

interface PlaylistMeta {
  name: string;
  description: string | null;
  cover_url: string | null;
  source: string;
  user_id: string;
  spotify_playlist_id: string | null;
}

function PlaylistDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { playQueue } = usePlayer();
  const [playlist, setPlaylist] = useState<PlaylistMeta | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const syncOneFn = useServerFn(syncSinglePlaylist);

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCoverFile, setEditCoverFile] = useState<File | null>(null);
  const [editCoverPreview, setEditCoverPreview] = useState<string | null>(null);
  const [removeExistingCover, setRemoveExistingCover] = useState(false);
  const [saving, setSaving] = useState(false);
  const editFileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      supabase.from("playlists").select("name, description, cover_url, source, user_id, spotify_playlist_id").eq("id", id).maybeSingle(),
      supabase.from("playlist_tracks").select("*").eq("playlist_id", id).order("position"),
    ]).then(([pl, tr]) => {
      setPlaylist(pl.data as PlaylistMeta | null);
      setTracks((tr.data ?? []) as Track[]);
      setLoading(false);
    });
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const queueTracks = tracks.map((t) => ({ ...t, sourceTable: "playlist_tracks" as const }));

  const handlePlayAll = () => {
    if (queueTracks.length === 0) return;
    playQueue(queueTracks, 0, { shuffle: false });
  };

  const handleShuffle = () => {
    if (queueTracks.length === 0) return;
    playQueue(queueTracks, 0, { shuffle: true });
  };

  const handleSyncFromSpotify = async () => {
    setSyncing(true);
    try {
      const r = await syncOneFn({ data: { playlistId: id } });
      toast.success(`Imported ${r.tracks} tracks from Spotify`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to sync");
    } finally {
      setSyncing(false);
    }
  };

  const deletePlaylist = async () => {
    const { error: tracksError } = await supabase.from("playlist_tracks").delete().eq("playlist_id", id);
    if (tracksError) {
      toast.error(tracksError.message);
      return;
    }
    const { error } = await supabase.from("playlists").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Playlist deleted");
    navigate({ to: "/playlists" });
  };

  const openEdit = () => {
    if (!playlist) return;
    setEditName(playlist.name);
    setEditDescription(playlist.description ?? "");
    setEditCoverFile(null);
    setEditCoverPreview(null);
    setRemoveExistingCover(false);
    setEditOpen(true);
  };

  const onPickEditCover = (file: File | null) => {
    if (!file) {
      setEditCoverFile(null);
      setEditCoverPreview(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Please pick an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }
    setEditCoverFile(file);
    setEditCoverPreview(URL.createObjectURL(file));
    setRemoveExistingCover(false);
  };

  const saveEdit = async () => {
    if (!playlist || !user || !editName.trim()) return;
    setSaving(true);
    try {
      let coverUrl: string | null | undefined = undefined;
      if (editCoverFile) {
        const ext = editCoverFile.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("playlist-covers")
          .upload(path, editCoverFile, { contentType: editCoverFile.type, upsert: false });
        if (upErr) {
          toast.error(`Cover upload failed: ${upErr.message}`);
          setSaving(false);
          return;
        }
        const { data: pub } = supabase.storage.from("playlist-covers").getPublicUrl(path);
        coverUrl = pub.publicUrl;
      } else if (removeExistingCover) {
        coverUrl = null;
      }

      const update: { name: string; description: string | null; cover_url?: string | null } = {
        name: editName.trim(),
        description: editDescription.trim() || null,
      };
      if (coverUrl !== undefined) update.cover_url = coverUrl;

      const { error } = await supabase.from("playlists").update(update).eq("id", id);
      if (error) {
        toast.error(error.message);
        setSaving(false);
        return;
      }
      toast.success("Playlist updated");
      setEditOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (!playlist) return <div className="p-8 text-muted-foreground">Playlist not found</div>;

  const isCustom = playlist.source === "custom";
  const isSpotifyLinked = playlist.source === "spotify" && !!playlist.spotify_playlist_id;

  // Neutral hero background — no gradient
  const heroGradient = "bg-secondary";

  return (
    <div className="animate-fade-in">
      <div className={`relative ${heroGradient} px-8 pb-10 pt-16`}>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background" />
        <div className="relative flex flex-col items-start gap-6 md:flex-row md:items-end">
          <div className="h-52 w-52 flex-shrink-0 overflow-hidden rounded-2xl bg-muted shadow-elegant ring-1 ring-white/10">
            {playlist.cover_url ? (
              <img src={playlist.cover_url} alt={playlist.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-background/30">
                <Music className="h-20 w-20 text-primary-foreground/80" />
              </div>
            )}
          </div>
          <div className="flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary-foreground/90">
              {isCustom ? "Custom Playlist" : playlist.source === "youtube" ? "YouTube Playlist" : "Spotify Playlist"}
            </p>
            <h1 className="mt-2 text-5xl font-bold tracking-tight md:text-6xl">{playlist.name}</h1>
            {playlist.description && <p className="mt-3 max-w-2xl text-primary-foreground/90">{playlist.description}</p>}
            <p className="mt-4 text-sm font-medium text-primary-foreground/90">
              {tracks.length} {tracks.length === 1 ? "song" : "songs"}
            </p>
          </div>
        </div>
      </div>

      <div className="px-8 pt-2">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Button onClick={handlePlayAll} disabled={tracks.length === 0} size="lg" className="gap-2 shadow-glow hover:scale-105 transition-all">
          <Play className="h-5 w-5 fill-current" /> Play
        </Button>
        <Button onClick={handleShuffle} disabled={tracks.length === 0} size="lg" variant="secondary" className="gap-2">
          <Shuffle className="h-5 w-5" /> Shuffle
        </Button>
        <AddSongDialog playlistId={id} onAdded={load} />
        {isSpotifyLinked && (
          <Button onClick={handleSyncFromSpotify} disabled={syncing} size="lg" variant="outline" className="gap-2">
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            {tracks.length === 0 ? "Sync from Spotify" : "Re-sync from Spotify"}
          </Button>
        )}
        {isCustom && (
          <Button onClick={openEdit} variant="outline" size="lg" className="gap-2">
            <Pencil className="h-4 w-4" /> Edit
          </Button>
        )}
        {isCustom && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="lg" className="gap-2">
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this playlist?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently remove "{playlist.name}" and all of its tracks. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={deletePlaylist}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit playlist</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Cover image</Label>
              <div className="flex items-center gap-3">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded bg-muted">
                  {editCoverPreview ? (
                    <>
                      <img src={editCoverPreview} alt="Cover preview" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => onPickEditCover(null)}
                        className="absolute right-0.5 top-0.5 rounded-full bg-background/80 p-0.5 text-foreground hover:bg-background"
                        aria-label="Remove new cover"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </>
                  ) : !removeExistingCover && playlist.cover_url ? (
                    <img src={playlist.cover_url} alt={playlist.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Music className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => editFileRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" />
                  {editCoverPreview || playlist.cover_url ? "Change" : "Upload"}
                </Button>
                {!editCoverPreview && playlist.cover_url && !removeExistingCover && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setRemoveExistingCover(true)}>
                    Remove
                  </Button>
                )}
                <input
                  ref={editFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onPickEditCover(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-pl-name">Name</Label>
              <Input id="edit-pl-name" value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-pl-desc">Description</Label>
              <Textarea id="edit-pl-desc" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={saving || !editName.trim()}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {tracks.length === 0 ? (
        <p className="text-muted-foreground">
          {isSpotifyLinked
            ? 'No tracks yet. Click "Sync from Spotify" above to import this playlist\'s tracks.'
            : 'No tracks yet. Click "Add song" above to add from Spotify or YouTube.'}
        </p>
      ) : (
        <TrackList
          tracks={tracks}
          table="playlist_tracks"
          playlistId={id}
          isCustomPlaylist={isCustom}
          onTrackRemoved={load}
        />
      )}
      </div>
    </div>
  );
}
