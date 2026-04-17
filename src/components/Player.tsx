import { useEffect, useRef, useState } from "react";
import YouTube from "react-youtube";
import type { YouTubePlayer } from "react-youtube";
import { Play, Pause, SkipBack, SkipForward, Music, Volume2, Shuffle } from "lucide-react";
import { usePlayer } from "@/lib/player-context";
import { useServerFn } from "@tanstack/react-start";
import { resolveYouTube } from "@/utils/youtube.functions";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function Player() {
  const { current, isPlaying, setIsPlaying, playNext, playPrev, shuffle, toggleShuffle } = usePlayer();
  const [videoId, setVideoId] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(70);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const resolveYT = useServerFn(resolveYouTube);

  // Resolve YouTube video for current track when it changes
  useEffect(() => {
    if (!current) {
      setVideoId(null);
      return;
    }
    if (current.youtube_video_id) {
      setVideoId(current.youtube_video_id);
      return;
    }

    let cancelled = false;
    const lookup = async () => {
      setResolving(true);
      setVideoId(null);

      const preferredTable = current.sourceTable ?? (current.spotify_track_id ? "liked_tracks" : "playlist_tracks");
      const fallbackTable = preferredTable === "liked_tracks" ? "playlist_tracks" : "liked_tracks";

      try {
        const result = await resolveYT({
          data: { table: preferredTable, trackId: current.id, title: current.title, artist: current.artist },
        });
        if (!cancelled && result.videoId) {
          setVideoId(result.videoId);
          return;
        }

        const fallback = await resolveYT({
          data: { table: fallbackTable, trackId: current.id, title: current.title, artist: current.artist },
        });
        if (!cancelled && fallback.videoId) {
          setVideoId(fallback.videoId);
          return;
        }

        if (!cancelled) toast.error(`Couldn't find "${current.title}" on YouTube`);
      } catch {
        try {
          const fallback = await resolveYT({
            data: { table: fallbackTable, trackId: current.id, title: current.title, artist: current.artist },
          });
          if (!cancelled && fallback.videoId) {
            setVideoId(fallback.videoId);
            return;
          }
          if (!cancelled) toast.error(`Couldn't find "${current.title}" on YouTube`);
        } catch {
          if (!cancelled) toast.error("YouTube lookup failed");
        }
      } finally {
        if (!cancelled) setResolving(false);
      }
    };

    void lookup();
    return () => {
      cancelled = true;
    };
  }, [current, resolveYT]);

  // Progress polling
  useEffect(() => {
    if (!playerRef.current) return;
    const id = setInterval(() => {
      try {
        const p = playerRef.current?.getCurrentTime?.() ?? 0;
        const d = playerRef.current?.getDuration?.() ?? 0;
        setProgress(p);
        setDuration(d);
      } catch {
        /* ignore */
      }
    }, 500);
    return () => clearInterval(id);
  }, [videoId]);

  // React to isPlaying toggle
  useEffect(() => {
    if (!playerRef.current) return;
    try {
      if (isPlaying) playerRef.current.playVideo();
      else playerRef.current.pauseVideo();
    } catch { /* ignore */ }
  }, [isPlaying]);

  // Volume changes
  useEffect(() => {
    try {
      playerRef.current?.setVolume?.(volume);
    } catch { /* ignore */ }
  }, [volume]);

  const fmt = (s: number) => {
    if (!s || !isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <footer className="border-t border-border bg-sidebar px-4 py-3">
      <div className="grid grid-cols-3 items-center gap-4">
        {/* Left: now playing */}
        <div className="flex min-w-0 items-center gap-3">
          <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded bg-muted">
            {current?.album_art_url ? (
              <img src={current.album_art_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Music className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{current?.title ?? "Nothing playing"}</div>
            <div className="truncate text-xs text-muted-foreground">{current?.artist ?? "Pick a song from your library"}</div>
          </div>
        </div>

        {/* Center: controls */}
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-4">
            <button onClick={playPrev} className="text-muted-foreground hover:text-foreground" aria-label="Previous">
              <SkipBack className="h-5 w-5" />
            </button>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              disabled={!current}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:scale-105 disabled:opacity-40"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
            </button>
            <button onClick={playNext} className="text-muted-foreground hover:text-foreground" aria-label="Next">
              <SkipForward className="h-5 w-5" />
            </button>
          </div>
          <div className="flex w-full max-w-md items-center gap-2 text-xs text-muted-foreground">
            <span className="w-9 text-right tabular-nums">{fmt(progress)}</span>
            <Slider
              value={[duration ? (progress / duration) * 100 : 0]}
              onValueChange={(v) => {
                if (!playerRef.current || !duration) return;
                const t = (v[0] / 100) * duration;
                playerRef.current.seekTo(t, true);
                setProgress(t);
              }}
              max={100}
              step={0.5}
              className="flex-1"
            />
            <span className="w-9 tabular-nums">{fmt(duration)}</span>
          </div>
        </div>

        {/* Right: volume */}
        <div className="flex items-center justify-end gap-2">
          <Volume2 className="h-4 w-4 text-muted-foreground" />
          <Slider
            value={[volume]}
            onValueChange={(v) => setVolume(v[0])}
            max={100}
            step={1}
            className="w-32"
          />
        </div>
      </div>

      {/* Hidden YouTube player */}
      <div className="sr-only h-0 w-0 overflow-hidden" aria-hidden>
        {videoId && (
          <YouTube
            videoId={videoId}
            opts={{
              playerVars: { autoplay: 1, controls: 0, modestbranding: 1 },
            }}
            onReady={(e) => {
              playerRef.current = e.target;
              try { e.target.setVolume(volume); } catch { /* ignore */ }
              if (isPlaying) e.target.playVideo();
            }}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnd={() => playNext()}
            onError={(e) => {
              // 2 = invalid id, 5 = HTML5 error, 100 = removed/private, 101/150 = embed disabled by owner
              const code = (e as unknown as { data: number }).data;
              const reasons: Record<number, string> = {
                2: "Invalid video",
                5: "Playback error",
                100: "Video removed or private",
                101: "Embedding disabled by uploader",
                150: "Embedding disabled by uploader",
              };
              const reason = reasons[code] ?? `Error ${code}`;
              console.error("[YouTube embed error]", code, "for", current?.title, videoId);
              toast.error(`${current?.title}: ${reason}`);
              setIsPlaying(false);
            }}
          />
        )}
      </div>

      {resolving && (
        <p className="mt-1 text-center text-xs text-muted-foreground">Finding "{current?.title}" on YouTube…</p>
      )}
    </footer>
  );
}
