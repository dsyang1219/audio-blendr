import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type DB = SupabaseClient<Database>;

export type TrackTable = "liked_tracks" | "playlist_tracks";

interface YTSearchItem {
  id: { videoId?: string };
  snippet: { title: string; channelTitle: string };
}

export type TrackLookupRow = {
  id: string;
  title: string;
  artist: string;
  youtube_video_id: string | null;
  spotify_track_id: string | null;
  user_id: string;
};

export class YouTubeQuotaError extends Error {
  constructor(message = "YouTube quota exceeded") {
    super(message);
    this.name = "YouTubeQuotaError";
  }
}

export async function searchYouTubeOnce(query: string): Promise<string | null> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.error("[youtube] Missing YOUTUBE_API_KEY env var");
    throw new Error("YouTube not configured");
  }

  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("q", query);
  url.searchParams.set("type", "video");
  url.searchParams.set("videoEmbeddable", "true");
  url.searchParams.set("maxResults", "5");
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text();
    console.error(`[youtube] search HTTP ${res.status} for query "${query}":`, body);
    if (res.status === 403 && /quota/i.test(body)) {
      throw new YouTubeQuotaError();
    }
    return null;
  }

  const json = (await res.json()) as { items?: YTSearchItem[] };
  const first = json.items?.find((item) => item.id?.videoId);
  if (!first) {
    console.warn(`[youtube] No results for query: "${query}"`);
    return null;
  }

  console.log(`[youtube] Resolved "${query}" -> ${first.id.videoId} (${first.snippet.title})`);
  return first.id.videoId ?? null;
}

/**
 * Strip trailing "(Remastered 2011)", "- Radio Edit", "(feat. X)" style
 * suffixes that hurt YouTube search relevance. Returns the original title
 * untouched when the suffix is the entire string.
 */
export function cleanTrackTitle(title: string): string {
  const cleaned = title
    .replace(/\s*[-(].*?(remaster|remix|version|feat\.?|ft\.?).*?[)]?$/i, "")
    .trim();
  return cleaned || title.trim();
}

export function buildYouTubeQuery(artist: string, title: string): string {
  return `${artist} - ${cleanTrackTitle(title)}`;
}

/**
 * Ordered fallback queries for resolving a track, most specific first.
 * Each search.list call costs 100 quota units, so callers should stop at
 * the first hit.
 */
export function buildYouTubeQueryLadder(artist: string, title: string): string[] {
  const cleanTitle = cleanTrackTitle(title);
  const ladder = [
    `${artist} - ${cleanTitle}`,
    `${artist} ${cleanTitle} audio`,
    `${artist} ${title}`,
    cleanTitle,
  ];
  return [...new Set(ladder.map((q) => q.trim()).filter(Boolean))];
}

export interface YouTubeVideoMeta {
  videoId: string;
  title: string;
  channel: string;
  thumbnail: string | null;
  durationSeconds: number | null;
}

/**
 * Parses an ISO 8601 duration (e.g. "PT3M42S") into seconds.
 */
export function parseIsoDuration(iso: string): number | null {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!match) return null;
  const [, h, m, s] = match;
  // Every component is optional in the pattern, so a bare "PT" would
  // otherwise parse as 0 seconds. Require at least one.
  if (h === undefined && m === undefined && s === undefined) return null;
  return Number(h ?? 0) * 3600 + Number(m ?? 0) * 60 + Number(s ?? 0);
}

/**
 * Fetch full metadata for up to 50 YouTube video IDs in ONE API call (1 quota unit).
 */
export async function fetchYouTubeVideoMetadata(
  videoIds: string[],
): Promise<Map<string, YouTubeVideoMeta>> {
  const result = new Map<string, YouTubeVideoMeta>();
  if (videoIds.length === 0) return result;

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new Error("YouTube not configured");

  // YouTube videos.list accepts up to 50 IDs per call
  for (let i = 0; i < videoIds.length; i += 50) {
    const chunk = videoIds.slice(i, i + 50);
    const url = new URL("https://www.googleapis.com/youtube/v3/videos");
    url.searchParams.set("part", "snippet,contentDetails");
    url.searchParams.set("id", chunk.join(","));
    url.searchParams.set("key", apiKey);

    const res = await fetch(url.toString());
    if (!res.ok) {
      const body = await res.text();
      console.error(`[youtube] videos.list HTTP ${res.status}:`, body);
      if (res.status === 403 && /quota/i.test(body)) throw new YouTubeQuotaError();
      continue;
    }

    const json = (await res.json()) as {
      items?: Array<{
        id: string;
        snippet: {
          title: string;
          channelTitle: string;
          thumbnails?: Record<string, { url: string }>;
        };
        contentDetails: { duration: string };
      }>;
    };

    for (const item of json.items ?? []) {
      const thumbs = item.snippet.thumbnails;
      const thumbnail = thumbs?.high?.url ?? thumbs?.medium?.url ?? thumbs?.default?.url ?? null;
      result.set(item.id, {
        videoId: item.id,
        title: item.snippet.title,
        channel: item.snippet.channelTitle,
        thumbnail,
        durationSeconds: parseIsoDuration(item.contentDetails.duration),
      });
    }
  }

  return result;
}

export async function findTrackRow(
  supabase: DB,
  table: TrackTable,
  userId: string,
  trackId: string,
  title?: string,
  artist?: string,
): Promise<TrackLookupRow | null> {
  const byId = await supabase
    .from(table)
    .select("id, title, artist, youtube_video_id, spotify_track_id, user_id")
    .eq("id", trackId)
    .maybeSingle();

  if (byId.data?.user_id === userId) return byId.data;

  const normalizedTitle = title?.trim();
  const normalizedArtist = artist?.trim();
  if (!normalizedTitle || !normalizedArtist) return null;

  const byMetadata = await supabase
    .from(table)
    .select("id, title, artist, youtube_video_id, spotify_track_id, user_id")
    .eq("user_id", userId)
    .ilike("title", normalizedTitle)
    .ilike("artist", normalizedArtist)
    .limit(1)
    .maybeSingle();

  return byMetadata.data ?? null;
}

// ---------------------------------------------------------------------------
// Shared match cache (see supabase/migrations/*_track_matches.sql)
// ---------------------------------------------------------------------------

const ARTIST_SEPARATOR = /\s*(?:,|;|\/|\bfeat\.?|\bft\.?|\bfeaturing\b)\s*/i;

/** Lowercase, strip accents and punctuation, collapse whitespace. */
export function normalizeText(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’'`]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** "The Weeknd, Daft Punk" / "A feat. B" -> "The Weeknd" / "A". */
export function primaryArtist(artist: string): string {
  const first = artist.split(ARTIST_SEPARATOR)[0]?.trim();
  return first || artist.trim();
}

/**
 * Key under which a song's YouTube match is shared between users. Deliberately
 * lossy — featured artists, remaster/remix suffixes, case and accents are all
 * dropped — so the same recording from different libraries collides.
 */
export function normalizeMatchKey(artist: string, title: string): string {
  return `${normalizeText(primaryArtist(artist))}|${normalizeText(cleanTrackTitle(title))}`;
}

export interface SharedMatch {
  id: string;
  videoId: string;
}

/**
 * Look up a shared match, preferring an exact Spotify track ID hit over the
 * fuzzier text key. Reads with the caller's RLS-scoped client. Any error
 * (including the table not existing yet) is treated as a miss so resolution
 * can fall through to a live search.
 */
export async function lookupSharedMatch(
  supabase: DB,
  artist: string,
  title: string,
  spotifyTrackId?: string | null,
): Promise<SharedMatch | null> {
  try {
    if (spotifyTrackId) {
      const bySpotify = await supabase
        .from("track_matches")
        .select("id, youtube_video_id")
        .eq("spotify_track_id", spotifyTrackId)
        .limit(1)
        .maybeSingle();
      if (bySpotify.data)
        return { id: bySpotify.data.id, videoId: bySpotify.data.youtube_video_id };
    }
    const byKey = await supabase
      .from("track_matches")
      .select("id, youtube_video_id")
      .eq("match_key", normalizeMatchKey(artist, title))
      .maybeSingle();
    if (byKey.error) throw byKey.error;
    return byKey.data ? { id: byKey.data.id, videoId: byKey.data.youtube_video_id } : null;
  } catch (e) {
    console.warn("[youtube] Shared match lookup failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * Record a match produced by a real YouTube search so other users skip the
 * search. Uses the service role because the table has no user write policies;
 * an existing row for the key is kept (first seen wins).
 */
export async function storeSharedMatch(input: {
  artist: string;
  title: string;
  spotifyTrackId?: string | null;
  videoId: string;
}): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from("track_matches").upsert(
      {
        match_key: normalizeMatchKey(input.artist, input.title),
        artist: input.artist,
        title: input.title,
        spotify_track_id: input.spotifyTrackId ?? null,
        youtube_video_id: input.videoId,
      },
      { onConflict: "match_key", ignoreDuplicates: true },
    );
    if (error) throw error;
  } catch (e) {
    console.warn("[youtube] Failed to store shared match:", e instanceof Error ? e.message : e);
  }
}

/** Fire-and-forget usage counter; never blocks resolution. */
export function recordSharedMatchHit(id: string): void {
  void supabaseAdmin.rpc("bump_track_match", { _id: id }).then(({ error }) => {
    if (error) console.warn("[youtube] bump_track_match failed:", error.message);
  });
}
