import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

async function getAuthUser() {
  const req = getRequest();
  const auth = req?.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) throw new Error("Not authenticated");
  const supa = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } }
  );
  const { data, error } = await supa.auth.getUser(token);
  if (error || !data.user) throw new Error("Invalid session");
  return data.user.id;
}

interface YTSearchItem {
  id: { videoId: string };
  snippet: { title: string };
}

async function searchYouTubeOnce(query: string): Promise<string | null> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new Error("YouTube not configured");
  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("q", query);
  url.searchParams.set("type", "video");
  url.searchParams.set("videoEmbeddable", "true");
  url.searchParams.set("maxResults", "1");
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) {
    console.error("YouTube search failed", res.status, await res.text());
    return null;
  }
  const json = (await res.json()) as { items?: YTSearchItem[] };
  return json.items?.[0]?.id?.videoId ?? null;
}

// Resolve a single track to a YouTube video id (cached in DB once found)
export const resolveYouTube = createServerFn({ method: "POST" })
  .inputValidator((d: { table: "liked_tracks" | "playlist_tracks"; trackId: string }) => d)
  .handler(async ({ data }) => {
    const userId = await getAuthUser();
    const { data: row, error } = await supabaseAdmin
      .from(data.table)
      .select("id, title, artist, youtube_video_id, user_id")
      .eq("id", data.trackId)
      .maybeSingle();
    if (error || !row) throw new Error("Track not found");
    if (row.user_id !== userId) throw new Error("Forbidden");
    if (row.youtube_video_id) return { videoId: row.youtube_video_id };

    const videoId = await searchYouTubeOnce(`${row.artist} ${row.title} official audio`);
    if (videoId) {
      await supabaseAdmin.from(data.table).update({ youtube_video_id: videoId }).eq("id", data.trackId);
    }
    return { videoId };
  });
