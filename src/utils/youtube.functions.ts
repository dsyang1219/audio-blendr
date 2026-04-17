import { createServerFn } from "@tanstack/react-start";
import { requireServerFnAuth } from "@/utils/server-fn-auth";
import {
  findTrackRow,
  searchYouTubeOnce,
  buildYouTubeQuery,
  YouTubeQuotaError,
  type DB,
  type TrackTable,
} from "@/utils/youtube.server";

const BATCH_CAP = 90;

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

export const batchResolveYouTube = createServerFn({ method: "POST" })
  .middleware([requireServerFnAuth])
  .inputValidator((d: { cap?: number }) => d ?? {})
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const supabase = context.supabase as DB;
    const cap = Math.max(1, Math.min(data.cap ?? BATCH_CAP, BATCH_CAP));

    const [liked, playlistTracks] = await Promise.all([
      supabase
        .from("liked_tracks")
        .select("id, title, artist")
        .eq("user_id", userId)
        .is("youtube_video_id", null)
        .limit(cap),
      supabase
        .from("playlist_tracks")
        .select("id, title, artist")
        .eq("user_id", userId)
        .is("youtube_video_id", null)
        .limit(cap),
    ]);

    type Pending = { table: TrackTable; id: string; title: string; artist: string };
    const pending: Pending[] = [
      ...(liked.data ?? []).map((r) => ({ table: "liked_tracks" as const, ...r })),
      ...(playlistTracks.data ?? []).map((r) => ({ table: "playlist_tracks" as const, ...r })),
    ].slice(0, cap);

    const totalUnresolved = (liked.data?.length ?? 0) + (playlistTracks.data?.length ?? 0);

    if (pending.length === 0) {
      return { resolved: 0, attempted: 0, remaining: 0, quotaHit: false, total: 0 };
    }

    let resolved = 0;
    let attempted = 0;
    let quotaHit = false;

    for (const track of pending) {
      attempted++;
      try {
        const videoId = await searchYouTubeOnce(buildYouTubeQuery(track.artist, track.title));
        if (videoId) {
          await supabase.from(track.table).update({ youtube_video_id: videoId }).eq("id", track.id);
          resolved++;
        }
      } catch (e) {
        if (e instanceof YouTubeQuotaError) {
          console.warn("[youtube] Quota hit during batch resolve, stopping early");
          quotaHit = true;
          attempted--;
          break;
        }
        console.error("[youtube] Batch resolve error for track", track.id, e);
      }
    }

    return {
      resolved,
      attempted,
      remaining: Math.max(0, totalUnresolved - resolved),
      quotaHit,
      total: totalUnresolved,
    };
  });
