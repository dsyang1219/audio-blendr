import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireServerFnAuth } from "@/utils/server-fn-auth";

type DB = SupabaseClient<Database>;

interface YTSearchItem {
  id: { videoId?: string };
  snippet: { title: string; channelTitle: string };
}

type TrackTable = "liked_tracks" | "playlist_tracks";

type TrackLookupRow = {
  id: string;
  title: string;
  artist: string;
  youtube_video_id: string | null;
  user_id: string;
};

async function searchYouTubeOnce(query: string): Promise<string | null> {
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

async function findTrackRow(
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

export const resolveYouTube = createServerFn({ method: "POST" })
  .middleware([requireServerFnAuth])
  .inputValidator((d: { table: TrackTable; trackId: string; title?: string; artist?: string }) => d)
  .handler(async ({ data, context }) => {
    const userId = context.userId;

    const row = await findTrackRow(data.table, userId, data.trackId, data.title, data.artist);
    if (!row) {
      console.error("[youtube] Track lookup failed", {
        table: data.table,
        trackId: data.trackId,
        title: data.title,
        artist: data.artist,
      });
      throw new Error("Track not found");
    }

    if (row.youtube_video_id) return { videoId: row.youtube_video_id };

    const cleanTitle = row.title.replace(/\s*[-(].*?(remaster|remix|version|feat\.?|ft\.?).*?[)]?$/i, "").trim();
    const queries = [
      `${row.artist} - ${cleanTitle}`,
      `${row.artist} ${cleanTitle} audio`,
      `${row.artist} ${row.title}`,
      cleanTitle,
    ];

    let videoId: string | null = null;
    for (const query of queries) {
      videoId = await searchYouTubeOnce(query);
      if (videoId) break;
    }

    if (videoId) {
      await supabaseAdmin.from(data.table).update({ youtube_video_id: videoId }).eq("id", row.id);
      return { videoId };
    }

    console.error(`[youtube] Could not resolve track: "${row.artist} - ${row.title}"`);
    return { videoId: null };
  });