import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

interface YTSearchItem {
  id: { videoId?: string };
  snippet: { title: string; channelTitle: string };
}

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
  const first = json.items?.find((i) => i.id?.videoId);
  if (!first) {
    console.warn(`[youtube] No results for query: "${query}"`);
    return null;
  }
  console.log(`[youtube] Resolved "${query}" -> ${first.id.videoId} (${first.snippet.title})`);
  return first.id.videoId ?? null;
}

// Resolve a single track to a YouTube video id (cached in DB once found)
export const resolveYouTube = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { table: "liked_tracks" | "playlist_tracks"; trackId: string }) => d)
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const { data: row, error } = await supabaseAdmin
      .from(data.table)
      .select("id, title, artist, youtube_video_id, user_id")
      .eq("id", data.trackId)
      .maybeSingle();
    if (error || !row) {
      console.error("[youtube] Track lookup failed", { table: data.table, trackId: data.trackId, error });
      throw new Error("Track not found");
    }
    if (row.user_id !== userId) throw new Error("Forbidden");
    if (row.youtube_video_id) return { videoId: row.youtube_video_id };

    // Try a few query variants — Spotify titles often include " - Remastered", featured artists, etc.
    const cleanTitle = row.title.replace(/\s*[-(].*?(remaster|remix|version|feat\.?|ft\.?).*?[)]?$/i, "").trim();
    const queries = [
      `${row.artist} - ${cleanTitle}`,
      `${row.artist} ${cleanTitle} audio`,
      `${row.artist} ${row.title}`,
      cleanTitle,
    ];

    let videoId: string | null = null;
    for (const q of queries) {
      videoId = await searchYouTubeOnce(q);
      if (videoId) break;
    }

    if (videoId) {
      await supabaseAdmin.from(data.table).update({ youtube_video_id: videoId }).eq("id", data.trackId);
    } else {
      console.error(`[youtube] Could not resolve track: "${row.artist} - ${row.title}"`);
    }
    return { videoId };
  });
