import { createServerFn } from "@tanstack/react-start";
import { requireServerFnAuth } from "@/utils/server-fn-auth";
import { createSpotifyState, getSpotifyRedirectUri, parseSpotifyState } from "@/utils/spotify-auth";

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

export const getSpotifyAuthUrl = createServerFn({ method: "POST" })
  .middleware([requireServerFnAuth])
  .inputValidator((d: { origin: string }) => d)
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    if (!clientId) throw new Error("Spotify not configured");

    const state = createSpotifyState(userId, data.origin);
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      redirect_uri: getSpotifyRedirectUri(),
      scope: SCOPES,
      state,
      show_dialog: "true",
    });
    return { url: `${SPOTIFY_AUTH_URL}?${params.toString()}` };
  });

export const completeSpotifyAuth = createServerFn({ method: "POST" })
  .middleware([requireServerFnAuth])
  .inputValidator((d: { code: string; state: string; origin: string }) => d)
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const supabase = context.supabase;
    const parsedState = parseSpotifyState(data.state);
    if (parsedState.userId !== userId) throw new Error("State mismatch");

    const clientId = process.env.SPOTIFY_CLIENT_ID!;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET!;

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code: data.code,
       redirect_uri: getSpotifyRedirectUri(),
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

    const meRes = await fetch(`${SPOTIFY_API}/me`, {
      headers: { Authorization: `Bearer ${tok.access_token}` },
    });
    const me = meRes.ok ? ((await meRes.json()) as { id: string; display_name?: string }) : null;

    const expiresAt = new Date(Date.now() + tok.expires_in * 1000).toISOString();

    const { error } = await supabase
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

async function refreshSpotifyToken(
  supabase: ReturnType<typeof Object>,
  userId: string
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb: any = supabase;
  const { data: conn, error } = await sb
    .from("spotify_connections")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !conn) throw new Error("Not connected to Spotify");

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
  await sb
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

export const getSpotifyStatus = createServerFn({ method: "POST" })
  .middleware([requireServerFnAuth])
  .handler(async ({ context }) => {
    const userId = context.userId;
    const { data } = await context.supabase
      .from("spotify_connections")
      .select("spotify_display_name, spotify_user_id, created_at")
      .eq("user_id", userId)
      .maybeSingle();
    return { connected: !!data, displayName: data?.spotify_display_name ?? null };
  });

export const disconnectSpotify = createServerFn({ method: "POST" })
  .middleware([requireServerFnAuth])
  .handler(async ({ context }) => {
    const userId = context.userId;
    await context.supabase.from("spotify_connections").delete().eq("user_id", userId);
    return { success: true };
  });

export const syncLikedSongs = createServerFn({ method: "POST" })
  .middleware([requireServerFnAuth])
  .handler(async ({ context }) => {
    const userId = context.userId;
    const supabase = context.supabase;
    const accessToken = await refreshSpotifyToken(supabase, userId);

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

    await supabase.from("liked_tracks").delete().eq("user_id", userId);
    if (tracks.length > 0) {
      const { error } = await supabase
        .from("liked_tracks")
        .insert(tracks.map((t) => ({ ...t, user_id: userId })));
      if (error) {
        console.error("Insert liked failed", error);
        throw new Error("Failed to save liked songs");
      }
    }
    return { count: tracks.length };
  });

export const searchSpotifyTracks = createServerFn({ method: "POST" })
  .middleware([requireServerFnAuth])
  .inputValidator((d: { query: string }) => d)
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const supabase = context.supabase;
    const accessToken = await refreshSpotifyToken(supabase, userId);
    const q = data.query.trim();
    if (!q) return { results: [] };

    const url = `${SPOTIFY_API}/search?q=${encodeURIComponent(q)}&type=track&limit=10`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) {
      console.error("Spotify search failed", res.status, await res.text());
      throw new Error("Spotify search failed");
    }
    const json = (await res.json()) as { tracks: { items: SpotifyTrackObj[] } };
    return { results: json.tracks.items.map(mapTrack) };
  });

export const addSpotifyTrackToPlaylist = createServerFn({ method: "POST" })
  .middleware([requireServerFnAuth])
  .inputValidator(
    (d: {
      playlistId?: string;
      spotify_track_id: string;
      title: string;
      artist: string;
      album: string | null;
      album_art_url: string | null;
      duration_seconds: number;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const supabase = context.supabase;

    if (data.playlistId) {
      const { data: pl } = await supabase
        .from("playlists")
        .select("id, user_id")
        .eq("id", data.playlistId)
        .maybeSingle();
      if (!pl || pl.user_id !== userId) throw new Error("Playlist not found");

      const { count } = await supabase
        .from("playlist_tracks")
        .select("id", { count: "exact", head: true })
        .eq("playlist_id", data.playlistId);

      const { error } = await supabase.from("playlist_tracks").insert({
        user_id: userId,
        playlist_id: data.playlistId,
        title: data.title,
        artist: data.artist,
        album: data.album,
        album_art_url: data.album_art_url,
        spotify_track_id: data.spotify_track_id,
        duration_seconds: data.duration_seconds,
        source: "spotify",
        position: count ?? 0,
      });
      if (error) throw new Error(error.message);
      return { title: data.title };
    }

    const { error } = await supabase.from("liked_tracks").insert({
      user_id: userId,
      title: data.title,
      artist: data.artist,
      album: data.album,
      album_art_url: data.album_art_url,
      spotify_track_id: data.spotify_track_id,
      duration_seconds: data.duration_seconds,
      source: "spotify",
    });
    if (error) throw new Error(error.message);
    return { title: data.title };
  });

export const syncPlaylists = createServerFn({ method: "POST" })
  .middleware([requireServerFnAuth])
  .handler(async ({ context }) => {
    const userId = context.userId;
    const supabase = context.supabase;
    const accessToken = await refreshSpotifyToken(supabase, userId);

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

    const syncedPlaylists: {
      name: string;
      description: string | null;
      image: string | null;
      rows: Array<ReturnType<typeof mapTrack> & { user_id: string; position: number; source: "spotify" }>;
    }[] = [];

    for (const p of playlists) {
      const tRes = await fetch(`${SPOTIFY_API}/playlists/${p.id}/tracks?limit=100`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!tRes.ok) {
        console.error("Fetch playlist tracks failed", p.id, tRes.status, await tRes.text());
        continue;
      }

      const tJson = (await tRes.json()) as { items: { track: SpotifyTrackObj | null }[] };
      const rows = tJson.items
        .map((it, idx) => (it.track ? { ...mapTrack(it.track), user_id: userId, position: idx, source: "spotify" as const } : null))
        .filter((x): x is NonNullable<typeof x> => !!x);

      if (rows.length === 0) {
        continue;
      }

      syncedPlaylists.push({
        name: p.name,
        description: p.description,
        image: p.image,
        rows,
      });
    }

    const { data: existingPlaylists } = await supabase.from("playlists").select("id").eq("user_id", userId);
    const existingIds = (existingPlaylists ?? []).map((playlist) => playlist.id);
    if (existingIds.length > 0) {
      const { error: deleteTracksError } = await supabase.from("playlist_tracks").delete().in("playlist_id", existingIds);
      if (deleteTracksError) {
        console.error("Delete old playlist tracks failed", deleteTracksError);
        throw new Error("Failed to refresh playlists");
      }
    }

    const { error: deletePlaylistsError } = await supabase.from("playlists").delete().eq("user_id", userId);
    if (deletePlaylistsError) {
      console.error("Delete old playlists failed", deletePlaylistsError);
      throw new Error("Failed to refresh playlists");
    }

    let totalTracks = 0;
    for (const p of syncedPlaylists) {
      const { data: pl, error: plErr } = await supabase
        .from("playlists")
        .insert({
          user_id: userId,
          name: p.name,
          description: p.description,
          cover_url: p.image,
          source: "spotify",
        })
        .select("id")
        .single();
      if (plErr || !pl) {
        console.error("Insert playlist failed", plErr);
        continue;
      }

      const rows = p.rows.map((row) => ({ ...row, playlist_id: pl.id }));
      const { error: insertTracksError } = await supabase.from("playlist_tracks").insert(rows);
      if (insertTracksError) {
        console.error("Insert playlist tracks failed", p.name, insertTracksError);
        await supabase.from("playlists").delete().eq("id", pl.id);
        continue;
      }

      totalTracks += rows.length;
    }

    return { playlists: syncedPlaylists.length, tracks: totalTracks };
  });
