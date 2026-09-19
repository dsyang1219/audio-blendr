import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import YouTube from "react-youtube";
import type { YouTubePlayer } from "react-youtube";
import {
  ListMusic,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { usePlayer } from "@/lib/player-context";
import { resolveYouTube } from "@/utils/youtube.functions";
import { Artwork } from "@/components/Artwork";
import { QueuePanel } from "@/components/QueuePanel";
import { Slider } from "@/components/ui/slider";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const SEEK_STEP_SECONDS = 10;
const PROGRESS_POLL_MS = 250;
const AUTOPLAY_CHECK_MS = 900;

// YT.PlayerState values
const YT_ENDED = 0;
const YT_PLAYING = 1;
const YT_BUFFERING = 3;

const YT_ERROR_MESSAGES: Record<number, string> = {
  2: "Invalid video",
  5: "Playback error",
  100: "Video removed or private",
  101: "Embedding disabled by uploader",
  150: "Embedding disabled by uploader",
};

function fmt(s: number) {
  if (!s || !isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function isTypingTarget(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

function safeCall<T>(fn: () => T): T | undefined {
  try {
    return fn();
  } catch {
    return undefined;
  }
}

/**
 * Seek bar with elapsed / total time. Owns its own polling so the progress
 * tick re-renders only this small component, never the whole footer. Polling
 * starts when the player reports ready — not when the video ID changes, which
 * happens before the player exists.
 */
function PlaybackProgress({
  playerRef,
  ready,
  className,
}: {
  playerRef: RefObject<YouTubePlayer | null>;
  ready: boolean;
  className?: string;
}) {
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seeking, setSeeking] = useState(false);

  useEffect(() => {
    if (!ready) {
      setProgress(0);
      setDuration(0);
      return;
    }
    const id = setInterval(() => {
      if (seeking) return;
      const p = safeCall(() => playerRef.current?.getCurrentTime?.()) ?? 0;
      const d = safeCall(() => playerRef.current?.getDuration?.()) ?? 0;
      setProgress(p);
      setDuration(d);
      if (d > 0 && "mediaSession" in navigator) {
        safeCall(() =>
          navigator.mediaSession.setPositionState?.({
            duration: d,
            playbackRate: 1,
            position: Math.min(p, d),
          }),
        );
      }
    }, PROGRESS_POLL_MS);
    return () => clearInterval(id);
  }, [playerRef, ready, seeking]);

  return (
    <div className={cn("flex w-full items-center gap-2 text-xs text-muted-foreground", className)}>
      <span className="w-9 text-right font-mono tabular-nums">{fmt(progress)}</span>
      <Slider
        value={[duration ? (progress / duration) * 100 : 0]}
        onValueChange={(v) => {
          if (!duration) return;
          setSeeking(true);
          setProgress((v[0] / 100) * duration);
        }}
        onValueCommit={(v) => {
          if (duration) {
            const t = (v[0] / 100) * duration;
            safeCall(() => playerRef.current?.seekTo(t, true));
            setProgress(t);
          }
          setTimeout(() => setSeeking(false), 250);
        }}
        max={100}
        step={0.5}
        disabled={!duration}
        aria-label="Seek"
        className="flex-1"
      />
      <span className="w-9 font-mono tabular-nums">{fmt(duration)}</span>
    </div>
  );
}

export function Player() {
  const {
    current,
    isPlaying,
    setIsPlaying,
    togglePlay,
    playNext,
    playPrev,
    shuffle,
    toggleShuffle,
    repeat,
    cycleRepeat,
    volume,
    setVolume,
    queue,
    currentIndex,
    setTrackVideoId,
  } = usePlayer();

  const [videoId, setVideoId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [muted, setMuted] = useState(false);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const prefetchedRef = useRef<Set<string>>(new Set());
  const resolveYT = useServerFn(resolveYouTube);

  const effectiveVolume = muted ? 0 : volume;

  // Latest values readable from stable callbacks and timers.
  const isPlayingRef = useRef(isPlaying);
  const repeatRef = useRef(repeat);
  isPlayingRef.current = isPlaying;
  repeatRef.current = repeat;

  // ---- Resolve the YouTube video for the current track --------------------
  // The <YouTube> element stays mounted across tracks: swapping the videoId
  // prop loads the next video into the SAME iframe. Tearing it down per track
  // would discard the playback permission the user's tap granted (mobile
  // browsers only allow audio after a gesture), forcing a tap on every song.
  useEffect(() => {
    if (!current) {
      setVideoId(null);
      return;
    }
    if (current.youtube_video_id) {
      setVideoId(current.youtube_video_id);
      return;
    }

    // Don't let the previous track keep playing while we look this one up.
    safeCall(() => playerRef.current?.pauseVideo());

    let cancelled = false;
    const lookup = async () => {
      setResolving(true);
      const preferredTable =
        current.sourceTable ?? (current.spotify_track_id ? "liked_tracks" : "playlist_tracks");
      const fallbackTable = preferredTable === "liked_tracks" ? "playlist_tracks" : "liked_tracks";

      // Sequential on purpose: a song saved in both Liked Songs and a playlist
      // would otherwise spend two 100-unit YouTube searches in parallel.
      const lookupOne = (table: typeof preferredTable) =>
        resolveYT({
          data: { table, trackId: current.id, title: current.title, artist: current.artist },
        }).catch(() => ({ videoId: null as string | null, quotaHit: false }));

      try {
        const preferred = await lookupOne(preferredTable);
        if (cancelled) return;
        const fallback =
          preferred.videoId || preferred.quotaHit
            ? { videoId: null as string | null, quotaHit: false }
            : await lookupOne(fallbackTable);
        if (cancelled) return;
        const found = preferred.videoId ?? fallback.videoId ?? null;
        if (found) {
          setVideoId(found);
          setTrackVideoId(current.id, found);
        } else {
          setVideoId(null);
          if (preferred.quotaHit || fallback.quotaHit) {
            toast.error("YouTube daily search quota reached — try again after midnight Pacific", {
              id: "yt-quota",
            });
          } else {
            toast.error(`Couldn't find "${current.title}" on YouTube`);
          }
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

  // Prefetch the next track's video ID so skipping feels instant.
  useEffect(() => {
    const next = queue[currentIndex + 1];
    if (!next || next.youtube_video_id || prefetchedRef.current.has(next.id)) return;
    prefetchedRef.current.add(next.id);
    const table = next.sourceTable ?? (next.spotify_track_id ? "liked_tracks" : "playlist_tracks");
    void resolveYT({ data: { table, trackId: next.id, title: next.title, artist: next.artist } })
      .then((res) => {
        if (res.videoId) setTrackVideoId(next.id, res.videoId);
      })
      .catch(() => prefetchedRef.current.delete(next.id));
  }, [queue, currentIndex, resolveYT, setTrackVideoId]);

  // ---- Playback plumbing ---------------------------------------------------
  useEffect(() => {
    if (!ready) return;
    safeCall(() => (isPlaying ? playerRef.current?.playVideo() : playerRef.current?.pauseVideo()));
  }, [isPlaying, ready]);

  useEffect(() => {
    safeCall(() => playerRef.current?.setVolume?.(effectiveVolume));
  }, [effectiveVolume]);

  const seekTo = useCallback((seconds: number) => {
    const d = safeCall(() => playerRef.current?.getDuration?.()) ?? 0;
    if (!d) return;
    safeCall(() => playerRef.current?.seekTo(Math.min(Math.max(seconds, 0), d), true));
  }, []);

  const seekBy = useCallback(
    (delta: number) => {
      const p = safeCall(() => playerRef.current?.getCurrentTime?.()) ?? 0;
      seekTo(p + delta);
    },
    [seekTo],
  );

  const toggleMute = useCallback(() => setMuted((m) => !m), []);

  // If the browser refused to auto-play (typical on iOS when the video loads
  // after the user's tap), stop claiming we're playing so the big Play button
  // is offered — one tap, which is a gesture, then starts audio.
  const checkAutoplay = useCallback(() => {
    setTimeout(() => {
      if (!isPlayingRef.current) return;
      const state = safeCall(() => playerRef.current?.getPlayerState?.());
      if (state !== undefined && state !== YT_PLAYING && state !== YT_BUFFERING) {
        setIsPlaying(false);
      }
    }, AUTOPLAY_CHECK_MS);
  }, [setIsPlaying]);

  // ---- Media Session: lock screen / headphone / OS media keys --------------
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    if (!current) {
      navigator.mediaSession.metadata = null;
      return;
    }
    navigator.mediaSession.metadata = new MediaMetadata({
      title: current.title,
      artist: current.artist,
      album: current.album ?? "",
      artwork: current.album_art_url
        ? [{ src: current.album_art_url, sizes: "512x512", type: "image/jpeg" }]
        : [],
    });
  }, [current]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = current ? (isPlaying ? "playing" : "paused") : "none";
  }, [current, isPlaying]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    const handlers: Array<[MediaSessionAction, MediaSessionActionHandler | null]> = [
      ["play", () => setIsPlaying(true)],
      ["pause", () => setIsPlaying(false)],
      ["previoustrack", () => playPrev()],
      ["nexttrack", () => playNext()],
      ["seekbackward", (d) => seekBy(-(d.seekOffset ?? SEEK_STEP_SECONDS))],
      ["seekforward", (d) => seekBy(d.seekOffset ?? SEEK_STEP_SECONDS)],
      ["seekto", (d) => typeof d.seekTime === "number" && seekTo(d.seekTime)],
    ];
    for (const [action, handler] of handlers) safeCall(() => ms.setActionHandler(action, handler));
    return () => {
      for (const [action] of handlers) safeCall(() => ms.setActionHandler(action, null));
    };
  }, [setIsPlaying, playPrev, playNext, seekBy, seekTo]);

  // ---- Keyboard shortcuts --------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      switch (e.key) {
        case " ":
          // Let a focused button handle its own Space press.
          if (e.target instanceof HTMLButtonElement) return;
          e.preventDefault();
          if (current) togglePlay();
          break;
        case "ArrowRight":
          e.preventDefault();
          if (e.shiftKey) playNext();
          else seekBy(SEEK_STEP_SECONDS);
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (e.shiftKey) playPrev();
          else seekBy(-SEEK_STEP_SECONDS);
          break;
        case "m":
        case "M":
          toggleMute();
          break;
        case "s":
        case "S":
          toggleShuffle();
          break;
        case "r":
        case "R":
          cycleRepeat();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, togglePlay, playNext, playPrev, seekBy, toggleMute, toggleShuffle, cycleRepeat]);

  // ---- Shared UI pieces ----------------------------------------------------
  const repeatButton = (size: "sm" | "lg") => (
    <button
      type="button"
      onClick={cycleRepeat}
      className={cn(
        "relative transition hover:text-foreground",
        repeat === "off" ? "text-muted-foreground" : "text-primary",
      )}
      aria-label={`Repeat: ${repeat}`}
      title={`Repeat ${repeat === "off" ? "off" : repeat === "all" ? "all" : "one"} (R)`}
    >
      {repeat === "one" ? (
        <Repeat1 className={size === "lg" ? "h-6 w-6" : "h-4 w-4"} />
      ) : (
        <Repeat className={size === "lg" ? "h-6 w-6" : "h-4 w-4"} />
      )}
    </button>
  );

  const shuffleButton = (size: "sm" | "lg") => (
    <button
      type="button"
      onClick={toggleShuffle}
      className={cn(
        "transition hover:text-foreground",
        shuffle ? "text-primary" : "text-muted-foreground",
      )}
      aria-label="Toggle shuffle"
      aria-pressed={shuffle}
      title={`Shuffle ${shuffle ? "on" : "off"} (S)`}
    >
      <Shuffle className={size === "lg" ? "h-6 w-6" : "h-4 w-4"} />
    </button>
  );

  const playPauseButton = (size: "sm" | "lg") => (
    <button
      type="button"
      onClick={togglePlay}
      disabled={!current}
      className={cn(
        "flex items-center justify-center rounded-full bg-foreground text-background shadow-glow transition-transform active:scale-95 disabled:opacity-40",
        size === "lg" ? "h-16 w-16" : "h-10 w-10 hover:scale-110 disabled:hover:scale-100",
        isPlaying && "animate-pulse-glow",
      )}
      aria-label={isPlaying ? "Pause" : "Play"}
      title={`${isPlaying ? "Pause" : "Play"} (Space)`}
    >
      {isPlaying ? (
        <Pause className={size === "lg" ? "h-7 w-7" : "h-4 w-4"} />
      ) : (
        <Play className={cn("fill-current", size === "lg" ? "h-7 w-7" : "h-4 w-4")} />
      )}
    </button>
  );

  const VolumeIcon = muted || effectiveVolume === 0 ? VolumeX : volume < 50 ? Volume1 : Volume2;

  return (
    <footer className="border-t border-border bg-sidebar/95 px-3 py-2.5 shadow-elegant sm:px-4 sm:py-3 md:bg-sidebar/90 md:backdrop-blur-xl">
      <div className="grid grid-cols-[1fr_auto] items-center gap-3 md:grid-cols-3 md:gap-4">
        {/* Left: now playing. On mobile this opens the full-screen sheet. */}
        <Sheet>
          <SheetTrigger asChild>
            <button
              type="button"
              disabled={!current}
              className="flex min-w-0 items-center gap-3 text-left disabled:opacity-100 md:pointer-events-none md:cursor-default"
              aria-label="Open now playing"
            >
              <div
                className={cn(
                  "h-11 w-11 flex-shrink-0 overflow-hidden rounded-lg bg-muted shadow-elegant transition-transform sm:h-14 sm:w-14",
                  isPlaying && "animate-float",
                )}
              >
                <Artwork src={current?.album_art_url} />
              </div>
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold sm:text-sm">
                  {current?.title ?? "Nothing playing"}
                </div>
                <div className="truncate text-[11px] text-muted-foreground sm:text-xs">
                  {resolving
                    ? "Finding on YouTube…"
                    : (current?.artist ?? "Pick a song from your library")}
                </div>
                {current?.album && (
                  <div className="hidden truncate text-[11px] text-muted-foreground/70 sm:block">
                    {current.album}
                  </div>
                )}
              </div>
            </button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="h-[100dvh] w-full border-0 bg-gradient-to-b from-sidebar via-background to-background p-0 md:hidden"
          >
            <SheetTitle className="sr-only">Now playing</SheetTitle>
            <div className="flex h-full flex-col px-6 pb-10 pt-6">
              <div className="mb-6">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  Now Playing
                </span>
              </div>
              <div className="mx-auto mb-8 aspect-square w-full max-w-sm overflow-hidden rounded-2xl bg-muted shadow-elegant ring-1 ring-white/10">
                <Artwork src={current?.album_art_url} iconClassName="max-h-24 max-w-24" />
              </div>
              <div className="mb-6 min-w-0">
                <div className="truncate text-2xl font-bold">
                  {current?.title ?? "Nothing playing"}
                </div>
                <div className="truncate text-base text-muted-foreground">
                  {current?.artist ?? "Pick a song from your library"}
                </div>
                {current?.album && (
                  <div className="mt-1 truncate text-sm text-muted-foreground/70">
                    {current.album}
                  </div>
                )}
              </div>
              <PlaybackProgress playerRef={playerRef} ready={ready} />
              <div className="mt-8 flex items-center justify-center gap-8">
                {shuffleButton("lg")}
                <button
                  type="button"
                  onClick={playPrev}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Previous"
                >
                  <SkipBack className="h-8 w-8" />
                </button>
                {playPauseButton("lg")}
                <button
                  type="button"
                  onClick={() => playNext()}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Next"
                >
                  <SkipForward className="h-8 w-8" />
                </button>
                {repeatButton("lg")}
              </div>
              <div className="mt-8 flex items-center gap-3">
                <button type="button" onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"}>
                  <VolumeIcon className="h-4 w-4 text-muted-foreground" />
                </button>
                <Slider
                  value={[effectiveVolume]}
                  onValueChange={(v) => {
                    setMuted(false);
                    setVolume(v[0]);
                  }}
                  max={100}
                  step={1}
                  aria-label="Volume"
                  className="flex-1"
                />
                <QueuePanel>
                  <button
                    type="button"
                    className="ml-2 text-muted-foreground hover:text-foreground"
                    aria-label="Open queue"
                  >
                    <ListMusic className="h-5 w-5" />
                  </button>
                </QueuePanel>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* Center: transport controls (desktop) */}
        <div className="order-last col-span-2 flex flex-col items-center gap-1 md:order-none md:col-auto">
          <div className="flex items-center gap-3 sm:gap-4">
            {shuffleButton("sm")}
            <button
              type="button"
              onClick={playPrev}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Previous"
              title="Previous (Shift+←)"
            >
              <SkipBack className="h-5 w-5" />
            </button>
            <div className="hidden md:block">{playPauseButton("sm")}</div>
            <button
              type="button"
              onClick={() => playNext()}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Next"
              title="Next (Shift+→)"
            >
              <SkipForward className="h-5 w-5" />
            </button>
            {repeatButton("sm")}
          </div>
          <PlaybackProgress
            playerRef={playerRef}
            ready={ready}
            className="hidden max-w-md md:flex"
          />
        </div>

        {/* Right: queue + volume (desktop); compact play button (mobile) */}
        <div className="flex items-center justify-end gap-2 md:gap-3">
          <div className="md:hidden">{playPauseButton("sm")}</div>
          <QueuePanel>
            <button
              type="button"
              className="hidden h-8 w-8 items-center justify-center rounded text-muted-foreground transition hover:bg-accent hover:text-foreground md:flex"
              aria-label="Open queue"
              title="Queue"
            >
              <ListMusic className="h-4 w-4" />
            </button>
          </QueuePanel>
          <button
            type="button"
            onClick={toggleMute}
            className="hidden h-8 w-8 items-center justify-center rounded text-muted-foreground transition hover:bg-accent hover:text-foreground md:flex"
            aria-label={muted ? "Unmute" : "Mute"}
            title={`${muted ? "Unmute" : "Mute"} (M)`}
          >
            <VolumeIcon className="h-4 w-4" />
          </button>
          <Slider
            value={[effectiveVolume]}
            onValueChange={(v) => {
              setMuted(false);
              setVolume(v[0]);
            }}
            max={100}
            step={1}
            aria-label="Volume"
            className="hidden w-28 md:flex"
          />
        </div>
      </div>

      {/* Mobile progress strip */}
      <PlaybackProgress playerRef={playerRef} ready={ready} className="mt-2 md:hidden" />

      {/* Hidden YouTube player — the audio source. Mounted once while a track
          is selected; track changes swap the videoId into the same iframe. */}
      <div className="sr-only h-0 w-0 overflow-hidden" aria-hidden>
        {videoId && (
          <YouTube
            videoId={videoId}
            opts={{
              // Privacy-enhanced host: YouTube stores nothing until the video plays.
              host: "https://www.youtube-nocookie.com",
              playerVars: { autoplay: 1, controls: 0, modestbranding: 1, playsinline: 1 },
            }}
            onReady={(e) => {
              playerRef.current = e.target;
              safeCall(() => e.target.setVolume(effectiveVolume));
              if (isPlayingRef.current) safeCall(() => e.target.playVideo());
              setReady(true);
              checkAutoplay();
            }}
            onStateChange={(e) => {
              const state = (e as unknown as { data: number }).data;
              if (state === YT_ENDED && repeatRef.current === "one") {
                safeCall(() => {
                  e.target.seekTo(0, true);
                  e.target.playVideo();
                });
              }
            }}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnd={() => {
              if (repeatRef.current !== "one") playNext(true);
            }}
            onError={(e) => {
              const code = (e as unknown as { data?: number }).data;
              const reason =
                (typeof code === "number" && YT_ERROR_MESSAGES[code]) ||
                (typeof code === "number" ? `Playback error (${code})` : "Playback failed");
              console.error("[YouTube embed error]", code, "for", current?.title, videoId);
              toast.error(`${current?.title ?? "Track"}: ${reason}`);
              setIsPlaying(false);
            }}
          />
        )}
      </div>
    </footer>
  );
}
