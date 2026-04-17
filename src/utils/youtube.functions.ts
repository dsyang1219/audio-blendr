import { createServerFn } from "@tanstack/react-start";
import { requireServerFnAuth } from "@/utils/server-fn-auth";
import { findTrackRow, searchYouTubeOnce, type DB, type TrackTable } from "@/utils/youtube.server";

export const resolveYouTube = createServerFn({ method: "POST" })
  .middleware([requireServerFnAuth])
  .inputValidator((d: { table: TrackTable; trackId: string; title?: string; artist?: string }) => d)
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const supabase = context.supabase as DB;

    const row = await findTrackRow(supabase, data.table, userId, data.trackId, data.title, data.artist);
    if (!row) {
      console.warn("[youtube] Track lookup failed", {
        table: data.table,
        trackId: data.trackId,
        title: data.title,
        artist: data.artist,
      });
      return { videoId: null };
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
      await supabase.from(data.table).update({ youtube_video_id: videoId }).eq("id", row.id);
      return { videoId };
    }

    console.error(`[youtube] Could not resolve track: "${row.artist} - ${row.title}"`);
    return { videoId: null };
  });