import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link2, Loader2, Music, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Artwork } from "@/components/Artwork";
import { useServerFn } from "@tanstack/react-start";
import { addYouTubeVideo } from "@/utils/youtube-import.functions";
import { searchSpotifyTracks, addSpotifyTrackToPlaylist } from "@/utils/spotify.functions";

interface SpotifyResult {
  spotify_track_id: string;
  title: string;
  artist: string;
  album: string | null;
  album_art_url: string | null;
  duration_seconds: number;
}

interface AddSongDialogProps {
  playlistId?: string;
  onAdded?: () => void;
  trigger?: React.ReactNode;
}

export function AddSongDialog({ playlistId, onAdded, trigger }: AddSongDialogProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"spotify" | "youtube">("spotify");

  // Spotify state
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SpotifyResult[]>([]);
  const [addingId, setAddingId] = useState<string | null>(null);

  // YouTube state
  const [ytUrl, setYtUrl] = useState("");
  const [ytAdding, setYtAdding] = useState(false);

  const search = useServerFn(searchSpotifyTracks);
  const addSpotify = useServerFn(addSpotifyTrackToPlaylist);
  const addYT = useServerFn(addYouTubeVideo);

  const destinationLabel = playlistId ? "playlist" : "Liked Songs";

  const runSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await search({ data: { query: query.trim() } });
      setResults(res.results as SpotifyResult[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Search failed");
    } finally {
      setSearching(false);
    }
  };

  const handleAddSpotify = async (track: SpotifyResult) => {
    setAddingId(track.spotify_track_id);
    try {
      await addSpotify({ data: { ...track, playlistId } });
      toast.success(`Added "${track.title}"`);
      onAdded?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add");
    } finally {
      setAddingId(null);
    }
  };

  const handleAddYT = async () => {
    if (!ytUrl.trim()) return;
    setYtAdding(true);
    try {
      const res = await addYT({ data: { url: ytUrl.trim(), playlistId } });
      toast.success(`Added "${res.title}"`);
      setYtUrl("");
      onAdded?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add video");
    } finally {
      setYtAdding(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="lg" variant="secondary" className="gap-2">
            <Plus className="h-5 w-5" /> Add song
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Add a song to {destinationLabel}</DialogTitle>
        </DialogHeader>
        <Tabs value={tab} onValueChange={(v) => setTab(v as "spotify" | "youtube")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="spotify" className="gap-2">
              <Music className="h-4 w-4" /> Spotify
            </TabsTrigger>
            <TabsTrigger value="youtube" className="gap-2">
              <Link2 className="h-4 w-4" /> From a link
            </TabsTrigger>
          </TabsList>

          <TabsContent value="spotify" className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Search Spotify (song, artist…)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void runSearch();
                }}
              />
              <Button onClick={runSearch} disabled={searching || !query.trim()}>
                {searching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div className="max-h-80 space-y-1 overflow-y-auto">
              {results.length === 0 && !searching ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Search Spotify to add tracks. Requires a connected Spotify account.
                </p>
              ) : (
                results.map((t) => (
                  <div
                    key={t.spotify_track_id}
                    className="flex items-center gap-3 rounded-md p-2 hover:bg-accent/40"
                  >
                    <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded bg-muted">
                      <Artwork src={t.album_art_url} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{t.title}</div>
                      <div className="truncate text-xs text-muted-foreground">{t.artist}</div>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleAddSpotify(t)}
                      disabled={addingId === t.spotify_track_id}
                    >
                      {addingId === t.spotify_track_id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="youtube" className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Paste a YouTube link"
                value={ytUrl}
                onChange={(e) => setYtUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleAddYT();
                }}
                disabled={ytAdding}
              />
              <Button onClick={handleAddYT} disabled={ytAdding || !ytUrl.trim()}>
                {ytAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Unreleased tracks, live versions, remixes — any youtube.com/watch, youtu.be or shorts
              link.
            </p>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
