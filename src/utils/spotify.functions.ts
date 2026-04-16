import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getAuthUserFromRequest } from "@/utils/auth.server";

const SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize";
const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_API = "https://api.spotify.com/v1";

const SCOPES = [
  "user-read-email",
  "user-read-private",
  "user-library-read",
  "playlist-read-private",
  "playlist-read-collaborative",
].join(" ");

function getRedirectUri(origin: string) {
  return `${origin}/spotify/callback`;
}


// Build the Spotify authorize URL for the current user
export const getSpotifyAuthUrl = createServerFn({ method: "POST" })
  .inputValidator((d: { origin: string }) => d)
  .handler(async ({ data }) => {
    const { userId } = await getAuthUserFromRequest();
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    if (!clientId) throw new Error("Spotify not configured");

    const state = `${userId}.${crypto.randomUUID()}`;
    // Store state briefly via signed cookie-less approach: encode userId in state
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      redirect_uri: getRedirectUri(data.origin),
      scope: SCOPES,
      state,
      show_dialog: "true",
    });
    return { url: `${SPOTIFY_AUTH_URL}?${params.toString()}` };
  });

// Exchange code for tokens and store
export const completeSpotifyAuth = createServerFn({ method: "POST" })
  .inputValidator((d: { code: string; state: string; origin: string }) => d)
  .handler(async ({ data }) => {
    const { userId } = await getAuthUserFromRequest();
    const stateUserId = data.state.split(".")[0];
    if (stateUserId !== userId) throw new Error("State mismatch");

    const clientId = process.env.SPOTIFY_CLIENT_ID!;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET!;

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code: data.code,
      redirect_uri: getRedirectUri(data.origin),
    });

    const tokenRes = await fetch(SPOTIFY_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      },
      body,
    });

    if (!tokenRes.ok) {
      const t = await tokenRes.text();
      console.error("Spotify token exchange failed", tokenRes.status, t);
      throw new Error("Failed to authorize with Spotify");
    }

    const tok = (await tokenRes.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      scope: string;
      token_type: string;
    };

    // Fetch profile
    const meRes = await fetch(`${SPOTIFY_API}/me`, {
      headers: { Authorization: `Bearer ${tok.access_token}` },
    });
    const me = meRes.ok ? ((await meRes.json()) as { id: string; display_name?: string }) : null;

    const expiresAt = new Date(Date.now() + tok.expires_in * 1000).toISOString();

    const { error } = await supabaseAdmin
      .from("spotify_connections")
      .upsert(
        {
          user_id: userId,
          access_token: tok.access_token,
          refresh_token: tok.refresh_token,
          expires_at: expiresAt,
          scope: tok.scope,
          spotify_user_id: me?.id ?? null,
          spotify_display_name: me?.display_name ?? null,
        },
        { onConflict: "user_id" }
      );

    if (error) {
      console.error("Failed to save spotify connection", error);
      throw new Error("Failed to save Spotify connection");
    }

    return { success: true, displayName: me?.display_name ?? null };
  });

async function refreshSpotifyToken(userId: string) {
  const { data: conn, error } = await supabaseAdmin
    .from("spotify_connections")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !conn) throw new Error("Not connected to Spotify");

  // Still fresh (>60s remaining)?
  if (new Date(conn.expires_at).getTime() - Date.now() > 60_000) {
    return conn.access_token;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID!;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET!;
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: conn.refresh_token,
  });

  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body,
  });

  if (!res.ok) {
    const t = await res.text();
    console.error("Spotify refresh failed", res.status, t);
    throw new Error("Spotify session expired — please reconnect");
  }

  const tok = (await res.json()) as { access_token: string; expires_in: number; refresh_token?: string };
  const expiresAt = new Date(Date.now() + tok.expires_in * 1000).toISOString();
  await supabaseAdmin
    .from("spotify_connections")
    .update({
      access_token: tok.access_token,
      expires_at: expiresAt,
      refresh_token: tok.refresh_token ?? conn.refresh_token,
    })
    .eq("user_id", userId);
  return tok.access_token;
}

interface SpotifyTrackObj {
  id: string;
  name: string;
  duration_ms: number;
  artists: { name: string }[];
  album: { name: string; images: { url: string }[] };
}

function mapTrack(t: SpotifyTrackObj) {
  return {
    spotify_track_id: t.id,
    title: t.name,
    artist: t.artists.map((a) => a.name).join(", "),
    album: t.album?.name ?? null,
    album_art_url: t.album?.images?.[0]?.url ?? null,
    duration_seconds: Math.round(t.duration_ms / 1000),
  };
}

// Get connection status
export const getSpotifyStatus = createServerFn({ method: "POST" }).handler(async () => {
  const { userId } = await getAuthUserFromRequest();
  const { data } = await supabaseAdmin
    .from("spotify_connections")
    .select("spotify_display_name, spotify_user_id, created_at")
    .eq("user_id", userId)
    .maybeSingle();
  return { connected: !!data, displayName: data?.spotify_display_name ?? null };
});

// Disconnect
export const disconnectSpotify = createServerFn({ method: "POST" }).handler(async () => {
  const { userId } = await getAuthUserFromRequest();
  await supabaseAdmin.from("spotify_connections").delete().eq("user_id", userId);
  return { success: true };
});

// Sync liked songs (first 200)
export const syncLikedSongs = createServerFn({ method: "POST" }).handler(async () => {
  const { userId } = await getAuthUserFromRequest();
  const accessToken = await refreshSpotifyToken(userId);

  const tracks: ReturnType<typeof mapTrack>[] = [];
  let url: string | null = `${SPOTIFY_API}/me/tracks?limit=50`;
  let pages = 0;
  while (url && pages < 4) {
    const res: Response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) {
      console.error("Spotify liked failed", res.status, await res.text());
      throw new Error("Failed to fetch liked songs");
    }
    const json = (await res.json()) as { items: { track: SpotifyTrackObj }[]; next: string | null };
    for (const it of json.items) if (it.track) tracks.push(mapTrack(it.track));
    url = json.next;
    pages++;
  }

  // Replace existing liked tracks
  await supabaseAdmin.from("liked_tracks").delete().eq("user_id", userId);
  if (tracks.length > 0) {
    const { error } = await supabaseAdmin
      .from("liked_tracks")
      .insert(tracks.map((t) => ({ ...t, user_id: userId })));
    if (error) {
      console.error("Insert liked failed", error);
      throw new Error("Failed to save liked songs");
    }
  }
  return { count: tracks.length };
});

// Sync playlists (metadata + tracks for each, capped)
export const syncPlaylists = createServerFn({ method: "POST" }).handler(async () => {
  const { userId } = await getAuthUserFromRequest();
  const accessToken = await refreshSpotifyToken(userId);

  // Get user's playlists
  const playlists: { id: string; name: string; description: string | null; image: string | null }[] = [];
  let plUrl: string | null = `${SPOTIFY_API}/me/playlists?limit=50`;
  while (plUrl) {
    const res: Response = await fetch(plUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) throw new Error("Failed to fetch playlists");
    const json = (await res.json()) as {
      items: { id: string; name: string; description: string | null; images: { url: string }[] }[];
      next: string | null;
    };
    for (const p of json.items) {
      playlists.push({
        id: p.id,
        name: p.name,
        description: p.description || null,
        image: p.images?.[0]?.url ?? null,
      });
    }
    plUrl = json.next;
  }

  // Wipe existing playlists for clean re-sync
  await supabaseAdmin.from("playlists").delete().eq("user_id", userId);

  let totalTracks = 0;
  for (const p of playlists) {
    const { data: pl, error: plErr } = await supabaseAdmin
      .from("playlists")
      .insert({
        user_id: userId,
        name: p.name,
        description: p.description,
        cover_url: p.image,
      })
      .select("id")
      .single();
    if (plErr || !pl) {
      console.error("Insert playlist failed", plErr);
      continue;
    }

    // Fetch first 100 tracks of playlist
    const tRes = await fetch(`${SPOTIFY_API}/playlists/${p.id}/tracks?limit=100`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!tRes.ok) continue;
    const tJson = (await tRes.json()) as { items: { track: SpotifyTrackObj | null }[] };

    const rows = tJson.items
      .map((it, idx) => (it.track ? { ...mapTrack(it.track), playlist_id: pl.id, user_id: userId, position: idx } : null))
      .filter((x): x is NonNullable<typeof x> => !!x);

    if (rows.length > 0) {
      await supabaseAdmin.from("playlist_tracks").insert(rows);
      totalTracks += rows.length;
    }
  }

  return { playlists: playlists.length, tracks: totalTracks };
});
