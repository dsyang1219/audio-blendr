import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

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
    .select("id, title, artist, youtube_video_id, user_id")
    .eq("id", trackId)
    .maybeSingle();

  if (byId.data?.user_id === userId) return byId.data;

  const normalizedTitle = title?.trim();
  const normalizedArtist = artist?.trim();
  if (!normalizedTitle || !normalizedArtist) return null;

  const byMetadata = await supabase
    .from(table)
    .select("id, title, artist, youtube_video_id, user_id")
    .eq("user_id", userId)
    .ilike("title", normalizedTitle)
    .ilike("artist", normalizedArtist)
    .limit(1)
    .maybeSingle();

  return byMetadata.data ?? null;
}
