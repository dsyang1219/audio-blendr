import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Music, Plus, Upload, X, Play, Search, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export const Route = createFileRoute("/_app/playlists")({
  component: PlaylistsIndex,
});

interface PL {
  id: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  source: string;
  sort_order: number;
}

function PlaylistsIndex() {
  const location = useLocation();
  const { user } = useAuth();
  const [playlists, setPlaylists] = useState<PL[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
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
      .select("id, name, description, cover_url, source, sort_order, updated_at")
      .order("sort_order", { ascending: true })
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

    // Place new playlist at the end of the user's custom order.
    const maxOrder = playlists.reduce((m, p) => Math.max(m, p.sort_order), -1);

    const { error } = await supabase.from("playlists").insert({
      user_id: user.id,
      name: name.trim(),
      description: description.trim() || null,
      cover_url: coverUrl,
      source: "custom",
      sort_order: maxOrder + 1,
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return playlists;
    return playlists.filter(
      (p) =>
        p.name.toLowerCase().includes(q) || (p.description?.toLowerCase().includes(q) ?? false),
    );
  }, [playlists, search]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    if (search.trim()) {
      // Don't reorder while filtered — would be confusing.
      toast.info("Clear search to reorder playlists");
      return;
    }

    const oldIndex = playlists.findIndex((p) => p.id === active.id);
    const newIndex = playlists.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(playlists, oldIndex, newIndex).map((p, i) => ({
      ...p,
      sort_order: i,
    }));
    setPlaylists(reordered);

    // Persist all rows with their new index. Small N — fine to do sequentially.
    const updates = reordered.map((p) =>
      supabase.from("playlists").update({ sort_order: p.sort_order }).eq("id", p.id),
    );
    const results = await Promise.all(updates);
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      toast.error("Failed to save new order");
      load();
    }
  };

  if (location.pathname !== "/playlists") {
    return <Outlet />;
  }

  return (
    <div className="p-4 md:p-8 animate-fade-in">
      <div className="mb-6 md:mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Your Playlists</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Curate, remix, and rediscover your music.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              variant="secondary"
              className="self-start sm:self-auto hover:scale-105 transition-all"
            >
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
                        <img
                          src={coverPreview}
                          alt="Cover preview"
                          className="h-full w-full object-cover"
                        />
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
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
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
                <Input
                  id="pl-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My awesome mix"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pl-desc">Description (optional)</Label>
                <Textarea
                  id="pl-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={create} disabled={busy || !name.trim()}>
                {busy ? "Creating…" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="mb-6 relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search playlists…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : playlists.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary">
            <Music className="h-8 w-8 text-secondary-foreground" />
          </div>
          <p className="text-lg font-semibold">No playlists yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create one above or sync from Spotify to get started.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No playlists match "{search}".</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={filtered.map((p) => p.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {filtered.map((p) => (
                <SortablePlaylistCard key={p.id} playlist={p} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

function SortablePlaylistCard({ playlist }: { playlist: PL }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: playlist.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : ("auto" as const),
  };

  return (
    <div ref={setNodeRef} style={style} className="relative">
      {/* Drag handle */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${playlist.name}`}
        className="absolute left-2 top-2 z-20 flex h-8 w-8 cursor-grab items-center justify-center rounded-full bg-background/80 text-foreground opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 active:cursor-grabbing"
        onClick={(e) => e.preventDefault()}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <Link
        to="/playlists/$id"
        params={{ id: playlist.id }}
        className="group hover-lift glass relative block rounded-2xl p-4 animate-scale-in"
      >
        <div className="relative mb-3 aspect-square overflow-hidden rounded-xl bg-muted shadow-elegant">
          {playlist.cover_url ? (
            <img
              src={playlist.cover_url}
              alt={playlist.name}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-secondary">
              <Music className="h-12 w-12 text-secondary-foreground" />
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          <div className="absolute bottom-2 right-2 flex h-11 w-11 translate-y-2 items-center justify-center rounded-full bg-foreground text-background opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
            <Play className="h-5 w-5 fill-current" />
          </div>
        </div>
        <h3 className="truncate font-semibold">{playlist.name}</h3>
        <p className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
          {playlist.source === "custom"
            ? "Custom"
            : playlist.source === "spotify"
              ? "Spotify"
              : playlist.source}
        </p>
        {playlist.description && (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{playlist.description}</p>
        )}
      </Link>
    </div>
  );
}
