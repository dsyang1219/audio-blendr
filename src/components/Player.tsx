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
  const { current, isPlaying, setIsPlaying, playNext, playPrev, shuffle, toggleShuffle, queue, currentIndex, setTrackVideoId } = usePlayer();
  const [videoId, setVideoId] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(70);
  const [seeking, setSeeking] = useState(false);
  const seekValueRef = useRef<number | null>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const resolveYT = useServerFn(resolveYouTube);
  const prefetchedRef = useRef<Set<string>>(new Set());

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
          setTrackVideoId(current.id, result.videoId);
          return;
        }

        const fallback = await resolveYT({
          data: { table: fallbackTable, trackId: current.id, title: current.title, artist: current.artist },
        });
        if (!cancelled && fallback.videoId) {
          setVideoId(fallback.videoId);
          setTrackVideoId(current.id, fallback.videoId);
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
            setTrackVideoId(current.id, fallback.videoId);
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
  }, [current, resolveYT, setTrackVideoId]);

  // Prefetch the next track's YouTube ID so it plays instantly when skipped to
  useEffect(() => {
    const next = queue[currentIndex + 1];
    if (!next || next.youtube_video_id) return;
    if (prefetchedRef.current.has(next.id)) return;
    prefetchedRef.current.add(next.id);

    const table = next.sourceTable ?? (next.spotify_track_id ? "liked_tracks" : "playlist_tracks");
    void resolveYT({ data: { table, trackId: next.id, title: next.title, artist: next.artist } })
      .then((res) => {
        if (res.videoId) setTrackVideoId(next.id, res.videoId);
      })
      .catch(() => {
        prefetchedRef.current.delete(next.id);
      });
  }, [queue, currentIndex, resolveYT, setTrackVideoId]);

  // Progress polling
  useEffect(() => {
    if (!playerRef.current) return;
    const id = setInterval(() => {
      if (seeking) return;
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
  }, [videoId, seeking]);

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
    <footer className="border-t border-border bg-sidebar/90 backdrop-blur-xl px-3 py-2.5 sm:px-4 sm:py-3 shadow-elegant">
      <div className="grid grid-cols-[1fr_auto] items-center gap-3 md:grid-cols-3 md:gap-4">
        {/* Left: now playing */}
        <div className="flex min-w-0 items-center gap-3">
          <div className={cn(
            "h-11 w-11 sm:h-14 sm:w-14 flex-shrink-0 overflow-hidden rounded-lg bg-muted shadow-elegant transition-transform",
            isPlaying && "animate-float"
          )}>
            {current?.album_art_url ? (
              <img src={current.album_art_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-secondary">
                <Music className="h-5 w-5 sm:h-6 sm:w-6 text-secondary-foreground" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="truncate text-xs sm:text-sm font-semibold">{current?.title ?? "Nothing playing"}</div>
            <div className="truncate text-[11px] sm:text-xs text-muted-foreground">{current?.artist ?? "Pick a song from your library"}</div>
            {current?.album && (
              <div className="hidden sm:block truncate text-[11px] text-muted-foreground/70">{current.album}</div>
            )}
          </div>
        </div>

        {/* Center: controls */}
        <div className="flex flex-col items-center gap-1 md:order-none order-last md:col-auto col-span-2">
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={toggleShuffle}
              className={cn(
                "hidden sm:inline-flex transition hover:text-foreground",
                shuffle ? "text-primary" : "text-muted-foreground"
              )}
              aria-label="Toggle shuffle"
              title={shuffle ? "Shuffle on" : "Shuffle off"}
            >
              <Shuffle className="h-4 w-4" />
            </button>
            <button onClick={playPrev} className="hidden sm:inline-flex text-muted-foreground hover:text-foreground" aria-label="Previous">
              <SkipBack className="h-5 w-5" />
            </button>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              disabled={!current}
              className={cn(
                "hidden md:flex h-10 w-10 items-center justify-center rounded-full bg-foreground text-background shadow-glow transition-all hover:scale-110 active:scale-95 disabled:opacity-40 disabled:hover:scale-100",
                isPlaying && "animate-pulse-glow"
              )}
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
            </button>
            <button onClick={playNext} className="hidden sm:inline-flex text-muted-foreground hover:text-foreground" aria-label="Next">
              <SkipForward className="h-5 w-5" />
            </button>
          </div>
          <div className="flex w-full max-w-md items-center gap-2 text-[10px] sm:text-xs text-muted-foreground">
            <span className="w-8 sm:w-9 text-right tabular-nums">{fmt(progress)}</span>
            <Slider
              value={[duration ? (progress / duration) * 100 : 0]}
              onValueChange={(v) => {
                if (!duration) return;
                setSeeking(true);
                const t = (v[0] / 100) * duration;
                seekValueRef.current = t;
                setProgress(t);
              }}
              onValueCommit={(v) => {
                if (!playerRef.current || !duration) {
                  setSeeking(false);
                  return;
                }
                const t = (v[0] / 100) * duration;
                try {
                  playerRef.current.seekTo(t, true);
                } catch { /* ignore */ }
                setProgress(t);
                seekValueRef.current = null;
                // Allow polling to resume after the player updates internally
                setTimeout(() => setSeeking(false), 250);
              }}
              max={100}
              step={0.5}
              className="flex-1"
            />
            <span className="w-8 sm:w-9 tabular-nums">{fmt(duration)}</span>
          </div>
        </div>

        {/* Right: mobile play button + desktop volume */}
        <div className="flex items-center justify-end gap-2">
          {/* Mobile-only play button */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            disabled={!current}
            className={cn(
              "md:hidden flex h-10 w-10 items-center justify-center rounded-full bg-foreground text-background shadow-glow transition-all active:scale-95 disabled:opacity-40",
              isPlaying && "animate-pulse-glow"
            )}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
          </button>
          {/* Desktop volume */}
          <Volume2 className="hidden md:inline-block h-4 w-4 text-muted-foreground" />
          <Slider
            value={[volume]}
            onValueChange={(v) => setVolume(v[0])}
            max={100}
            step={1}
            className="hidden md:flex w-32"
          />
        </div>
      </div>

      {/* Hidden YouTube player */}
      <div className="sr-only h-0 w-0 overflow-hidden" aria-hidden>
        {videoId && (
          <YouTube
            videoId={videoId}
            opts={{
              playerVars: { autoplay: 1, controls: 0, modestbranding: 1, playsinline: 1 },
            }}
            onReady={(e) => {
              playerRef.current = e.target;
              try { e.target.setVolume(volume); } catch { /* ignore */ }
              try { e.target.playVideo(); } catch { /* ignore */ }
              setIsPlaying(true);
            }}
            onStateChange={(e) => {
              // YT.PlayerState: -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued
              const state = (e as unknown as { data: number }).data;
              if (state === 5 || state === -1) {
                // Cued or unstarted after a video swap — kick playback
                try { e.target.playVideo(); } catch { /* ignore */ }
              }
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
