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