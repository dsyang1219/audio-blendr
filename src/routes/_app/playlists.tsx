import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Music, Plus, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_app/playlists")({
  component: PlaylistsIndex,
});

interface PL {
  id: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  source: string;
}

function PlaylistsIndex() {
  const location = useLocation();
  const { user } = useAuth();
  const [playlists, setPlaylists] = useState<PL[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = () => {
    supabase
      .from("playlists")
      .select("id, name, description, cover_url, source, updated_at")
      .order("updated_at", { ascending: false })
      .then(({ data }) => {
        setPlaylists((data ?? []) as PL[]);
        setLoading(false);
      });
  };

  useEffect(() => {
    load();
  }, []);

  const onPickCover = (file: File | null) => {
    if (!file) {
      setCoverFile(null);
      setCoverPreview(null);
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
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setCoverFile(null);
    setCoverPreview(null);
  };

  const create = async () => {
    if (!user || !name.trim()) return;
    setBusy(true);

    let coverUrl: string | null = null;
    if (coverFile) {
      const ext = coverFile.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("playlist-covers")
        .upload(path, coverFile, { contentType: coverFile.type, upsert: false });
      if (upErr) {
        setBusy(false);
        toast.error(`Cover upload failed: ${upErr.message}`);
        return;
      }
      const { data: pub } = supabase.storage.from("playlist-covers").getPublicUrl(path);
      coverUrl = pub.publicUrl;
    }

    const { error } = await supabase.from("playlists").insert({
      user_id: user.id,
      name: name.trim(),
      description: description.trim() || null,
      cover_url: coverUrl,
      source: "custom",
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Playlist created");
    resetForm();
    setOpen(false);
    load();
  };

  if (location.pathname !== "/playlists") {
    return <Outlet />;
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Your Playlists</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> New Playlist
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a playlist</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Cover image (optional)</Label>
                <div className="flex items-center gap-3">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded bg-muted">
                    {coverPreview ? (
                      <>
                        <img src={coverPreview} alt="Cover preview" className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => onPickCover(null)}
                          className="absolute right-0.5 top-0.5 rounded-full bg-background/80 p-0.5 text-foreground hover:bg-background"
                          aria-label="Remove cover"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </>
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Music className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="mr-2 h-4 w-4" />
                    {coverPreview ? "Change" : "Upload"}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => onPickCover(e.target.files?.[0] ?? null)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pl-name">Name</Label>
                <Input id="pl-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="My awesome mix" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pl-desc">Description (optional)</Label>
                <Textarea id="pl-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={create} disabled={busy || !name.trim()}>
                {busy ? "Creating…" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : playlists.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">No playlists yet. Create one above or sync from Spotify.</p>
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
              <p className="mt-1 text-xs text-muted-foreground">
                {p.source === "custom" ? "Custom" : p.source === "spotify" ? "Spotify" : p.source}
              </p>
              {p.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{p.description}</p>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
