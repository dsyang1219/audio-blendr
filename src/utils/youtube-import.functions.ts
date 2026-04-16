import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getAuthUserFromRequest } from "@/utils/auth.server";

async function getAuthUser() {
  const { userId } = await getAuthUserFromRequest();
  return userId;
}

function extractVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return v;
      // Shorts
      const m = u.pathname.match(/\/shorts\/([^/?]+)/);
      if (m) return m[1];
    }
  } catch {
    /* not a URL — maybe the user pasted just an ID */
  }
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return url;
  return null;
}

function extractPlaylistId(url: string): string | null {
  try {
    const u = new URL(url);
    const list = u.searchParams.get("list");
    if (list) return list;
  } catch { /* ignore */ }
  if (/^PL[a-zA-Z0-9_-]+$/.test(url) || /^[a-zA-Z0-9_-]{13,}$/.test(url)) return url;
  return null;
}

interface YTVideoMeta {
  id: string;
  snippet: { title: string; channelTitle: string; thumbnails: { medium?: { url: string }; high?: { url: string } } };
  contentDetails: { duration: string };
}

function parseISODuration(iso: string): number {
  // PT#H#M#S
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (Number(m[1] || 0) * 3600) + (Number(m[2] || 0) * 60) + Number(m[3] || 0);
}

async function fetchVideoMeta(videoIds: string[]): Promise<YTVideoMeta[]> {
  const apiKey = process.env.YOUTUBE_API_KEY!;
  const url = new URL("https://www.googleapis.com/youtube/v3/videos");
  url.searchParams.set("part", "snippet,contentDetails");
  url.searchParams.set("id", videoIds.join(","));
  url.searchParams.set("key", apiKey);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("YouTube videos API failed");
  const json = (await res.json()) as { items: YTVideoMeta[] };
  return json.items;
}

export const addYouTubeVideo = createServerFn({ method: "POST" })
  .inputValidator((d: { url: string }) => d)
  .handler(async ({ data }) => {
    const userId = await getAuthUser();
    const videoId = extractVideoId(data.url.trim());
    if (!videoId) throw new Error("Invalid YouTube URL");

    const meta = await fetchVideoMeta([videoId]);
    if (meta.length === 0) throw new Error("Video not found");
    const v = meta[0];

    const title = v.snippet.title;
    const artist = v.snippet.channelTitle;
    const art = v.snippet.thumbnails?.high?.url ?? v.snippet.thumbnails?.medium?.url ?? null;
    const duration = parseISODuration(v.contentDetails.duration);

    const { error } = await supabaseAdmin.from("liked_tracks").insert({
      user_id: userId,
      title,
      artist,
      album: null,
      album_art_url: art,
      youtube_video_id: v.id,
      duration_seconds: duration,
      source: "youtube",
    });
    if (error) {
      console.error("Insert YT video failed", error);
      throw new Error("Failed to add video");
    }
    return { title, videoId: v.id };
  });

interface YTPlaylistItem {
  contentDetails: { videoId: string };
}

export const importYouTubePlaylist = createServerFn({ method: "POST" })
  .inputValidator((d: { url: string; name?: string }) => d)
  .handler(async ({ data }) => {
    const userId = await getAuthUser();
    const apiKey = process.env.YOUTUBE_API_KEY!;
    const playlistId = extractPlaylistId(data.url.trim());
    if (!playlistId) throw new Error("Invalid YouTube playlist URL");

    // Get playlist meta for default name + cover
    let playlistName = data.name?.trim() || "YouTube Playlist";
    let cover: string | null = null;
    try {
      const plRes = await fetch(
        `https://www.googleapis.com/youtube/v3/playlists?part=snippet&id=${playlistId}&key=${apiKey}`
      );
      if (plRes.ok) {
        const plJson = (await plRes.json()) as {
          items: { snippet: { title: string; thumbnails: { high?: { url: string }; medium?: { url: string } } } }[];
        };
        if (plJson.items[0]) {
          if (!data.name) playlistName = plJson.items[0].snippet.title;
          cover = plJson.items[0].snippet.thumbnails?.high?.url ?? plJson.items[0].snippet.thumbnails?.medium?.url ?? null;
        }
      }
    } catch { /* non-fatal */ }

    // Page through items
    const videoIds: string[] = [];
    let pageToken: string | undefined;
    let pages = 0;
    while (pages < 4) { // up to 200 items
      const u = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
      u.searchParams.set("part", "contentDetails");
      u.searchParams.set("playlistId", playlistId);
      u.searchParams.set("maxResults", "50");
      u.searchParams.set("key", apiKey);
      if (pageToken) u.searchParams.set("pageToken", pageToken);
      const res = await fetch(u.toString());
      if (!res.ok) {
        const t = await res.text();
        console.error("playlistItems failed", res.status, t);
        throw new Error("Failed to fetch playlist (is it public?)");
      }
      const json = (await res.json()) as { items: YTPlaylistItem[]; nextPageToken?: string };
      for (const it of json.items) videoIds.push(it.contentDetails.videoId);
      if (!json.nextPageToken) break;
      pageToken = json.nextPageToken;
      pages++;
    }

    if (videoIds.length === 0) throw new Error("No videos found in this playlist");

    // Fetch metadata in chunks of 50
    const allMeta: YTVideoMeta[] = [];
    for (let i = 0; i < videoIds.length; i += 50) {
      const chunk = videoIds.slice(i, i + 50);
      const meta = await fetchVideoMeta(chunk);
      allMeta.push(...meta);
    }

    // Create playlist
    const { data: pl, error: plErr } = await supabaseAdmin
      .from("playlists")
      .insert({
        user_id: userId,
        name: playlistName,
        description: "Imported from YouTube",
        cover_url: cover,
        source: "youtube",
      })
      .select("id")
      .single();
    if (plErr || !pl) {
      console.error("Insert YT playlist failed", plErr);
      throw new Error("Failed to create playlist");
    }

    const rows = allMeta.map((v, idx) => ({
      user_id: userId,
      playlist_id: pl.id,
      position: idx,
      title: v.snippet.title,
      artist: v.snippet.channelTitle,
      album: null,
      album_art_url: v.snippet.thumbnails?.high?.url ?? v.snippet.thumbnails?.medium?.url ?? null,
      youtube_video_id: v.id,
      duration_seconds: parseISODuration(v.contentDetails.duration),
      source: "youtube",
    }));

    if (rows.length > 0) {
      const { error: insErr } = await supabaseAdmin.from("playlist_tracks").insert(rows);
      if (insErr) {
        console.error("Insert YT playlist tracks failed", insErr);
        throw new Error("Failed to save playlist tracks");
      }
    }

    return { name: playlistName, tracks: rows.length };
  });
