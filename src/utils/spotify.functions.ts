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

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryDelayMs(retryAfterHeader: string | null, fallbackMs: number) {
  const retryAfterSeconds = Number(retryAfterHeader);
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return Math.min(retryAfterSeconds * 1000, 60_000);
  }

  return fallbackMs;
}

async function spotifyFetch(url: string, accessToken: string, maxRetries = 2): Promise<Response> {
  let attempt = 0;
  let delay = 800;

  while (true) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (res.status !== 429) return res;
    if (attempt >= maxRetries) return res;

    // Cap retry waits to a few seconds so we never block the worker for long.
    // If Spotify is heavily rate-limiting, we bail and let the user re-trigger
    // sync — each click resumes from where the previous one stopped.
    const waitMs = Math.min(getRetryDelayMs(res.headers.get("retry-after"), delay), 4_000);
    console.warn(`Spotify 429, waiting ${waitMs}ms (attempt ${attempt + 1}/${maxRetries})`);
    await wait(waitMs);
    delay = Math.min(Math.round(delay * 1.8), 4_000);
    attempt++;
  }
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
    album: null as string | null,
    album_art_url: null as string | null,
    duration_seconds: null as number | null,
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

// Only request the bare-minimum fields: track id, title, artist names.
// Skipping album / images / duration shrinks payloads and reduces 429s.
const TRACK_FIELDS = "next,items(track(id,name,artists(name)))";
const PLAYLIST_LIST_FIELDS = "next,items(id,name,description,images(url))";

async function fetchAllPlaylistTracks(
  spotifyPlaylistId: string,
  accessToken: string,
  userId: string,
): Promise<{ rows: Array<ReturnType<typeof mapTrack> & { user_id: string; position: number; source: "spotify" }> | null; status: number }> {
  const rows: Array<ReturnType<typeof mapTrack> & { user_id: string; position: number; source: "spotify" }> = [];
  let url: string | null = `${SPOTIFY_API}/playlists/${spotifyPlaylistId}/tracks?limit=100&fields=${encodeURIComponent(TRACK_FIELDS)}`;
  let position = 0;
  let pageCount = 0;

  while (url && pageCount < 10) {
    const res: Response = await spotifyFetch(url, accessToken);
    if (!res.ok) {
      console.error("Fetch playlist tracks failed", spotifyPlaylistId, res.status, await res.text());
      return { rows: null, status: res.status };
    }

    const json = (await res.json()) as { items: { track: SpotifyTrackObj | null }[]; next: string | null };
    for (const it of json.items) {
      if (!it.track) continue;
      rows.push({ ...mapTrack(it.track), user_id: userId, position: position++, source: "spotify" as const });
    }

    url = json.next;
    pageCount++;
  }

  return { rows, status: 200 };
}

export const syncPlaylists = createServerFn({ method: "POST" })
  .middleware([requireServerFnAuth])
  .handler(async ({ context }) => {
    const userId = context.userId;
    const supabase = context.supabase;
    const accessToken = await refreshSpotifyToken(supabase, userId);

    // Get already-synced Spotify playlist IDs so we can skip them
    const { data: existing } = await supabase
      .from("playlists")
      .select("spotify_playlist_id")
      .eq("user_id", userId)
      .eq("source", "spotify")
      .not("spotify_playlist_id", "is", null);
    const alreadySynced = new Set((existing ?? []).map((p) => p.spotify_playlist_id).filter(Boolean));

    const playlists: { id: string; name: string; description: string | null; image: string | null }[] = [];
    let plUrl: string | null = `${SPOTIFY_API}/me/playlists?limit=50&fields=${encodeURIComponent(PLAYLIST_LIST_FIELDS)}`;
    let pageCount = 0;
    let partialReason: string | null = null;
    while (plUrl && pageCount < 20) {
      const res: Response = await spotifyFetch(plUrl, accessToken);
      if (!res.ok) {
        const errText = await res.text();
        console.error("Spotify /me/playlists failed", res.status, errText);
        if (pageCount === 0) {
          if (res.status === 401 || res.status === 403) {
            throw new Error("Spotify session expired — please reconnect on the Connect page");
          }
          if (res.status === 429) {
            return { playlists: 0, tracks: 0, skipped: 0, partial: true, message: "Spotify is rate-limiting requests right now — please wait a few minutes and try again." };
          }
          throw new Error(`Spotify returned ${res.status} when fetching your playlists`);
        }
        partialReason = res.status === 429
          ? "Spotify rate-limited some playlist pages, so only part of your library was listed."
          : `Spotify stopped returning playlist pages (${res.status}).`;
        break;
      }
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
      pageCount++;
    }

    // Filter to only NEW playlists (incremental)
    const allNewPlaylists = playlists.filter((p) => !alreadySynced.has(p.id));
    const skippedCount = playlists.length - allNewPlaylists.length;

    // Process a larger batch per request, but fetch playlist tracks in parallel
    // (Spotify's per-playlist endpoint is fast; the bottleneck was sequential fetching).
    const BATCH_SIZE = 15;
    const CONCURRENCY = 4;
    const newPlaylists = allNewPlaylists.slice(0, BATCH_SIZE);
    const remaining = allNewPlaylists.length - newPlaylists.length;

    let inserted = 0;
    let totalTracks = 0;
    let rateLimitedAny = false;

    // Run fetches in parallel chunks
    for (let i = 0; i < newPlaylists.length; i += CONCURRENCY) {
      const chunk = newPlaylists.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        chunk.map(async (p) => ({ p, ...(await fetchAllPlaylistTracks(p.id, accessToken, userId)) })),
      );

      for (const { p, rows, status } of results) {
        if (!rows) {
          if (status === 429) {
            rateLimitedAny = true;
            continue;
          }
          // 403 or other: skip this playlist but continue with others
          continue;
        }
        if (rows.length === 0) continue;

        const { data: pl, error: plErr } = await supabase
          .from("playlists")
          .insert({
            user_id: userId,
            name: p.name,
            description: p.description,
            cover_url: p.image,
            source: "spotify",
            spotify_playlist_id: p.id,
          })
          .select("id")
          .single();
        if (plErr || !pl) {
          console.error("Insert playlist failed", plErr);
          continue;
        }

        const tracksWithPlaylist = rows.map((row) => ({ ...row, playlist_id: pl.id }));
        const { error: insErr } = await supabase.from("playlist_tracks").insert(tracksWithPlaylist);
        if (insErr) {
          console.error("Insert playlist tracks failed", p.name, insErr);
          await supabase.from("playlists").delete().eq("id", pl.id);
          continue;
        }
        inserted++;
        totalTracks += rows.length;
      }

      // If we're getting rate-limited, stop early so user can retry
      if (rateLimitedAny) break;
    }

    const stillRemaining = remaining + (rateLimitedAny ? newPlaylists.length - inserted : 0);
    const isPartial = rateLimitedAny || partialReason !== null || stillRemaining > 0;

    let message: string | null = null;
    if (rateLimitedAny && inserted === 0) {
      message = `Spotify is rate-limiting right now. ${stillRemaining} playlists left — wait a few seconds and click Sync again.`;
    } else if (stillRemaining > 0) {
      message = `Imported ${inserted} playlists (${totalTracks} tracks). ${stillRemaining} more to go — click Sync again to continue.`;
    } else if (partialReason) {
      message = partialReason;
    } else if (inserted === 0 && skippedCount > 0) {
      message = `All ${skippedCount} playlists are already synced — nothing new to import.`;
    } else if (inserted > 0) {
      message = `Synced ${inserted} new playlists (${totalTracks} tracks). All caught up!`;
    }

    return {
      playlists: inserted,
      tracks: totalTracks,
      skipped: skippedCount,
      remaining: stillRemaining,
      partial: isPartial,
      message,
    };
  });

export const syncSinglePlaylist = createServerFn({ method: "POST" })
  .middleware([requireServerFnAuth])
  .inputValidator((d: { playlistId: string }) => d)
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const supabase = context.supabase;

    const { data: pl } = await supabase
      .from("playlists")
      .select("id, user_id, source, spotify_playlist_id")
      .eq("id", data.playlistId)
      .maybeSingle();
    if (!pl || pl.user_id !== userId) throw new Error("Playlist not found");
    if (pl.source !== "spotify" || !pl.spotify_playlist_id) {
      throw new Error("This playlist isn't linked to Spotify");
    }

    const accessToken = await refreshSpotifyToken(supabase, userId);
    const { rows, status } = await fetchAllPlaylistTracks(pl.spotify_playlist_id, accessToken, userId);
    if (!rows) {
      if (status === 429) throw new Error("Spotify is rate-limiting right now — please wait a few minutes and try again");
      if (status === 403) throw new Error("Spotify denied access to this playlist (it may be an algorithmic playlist like Discover Weekly that isn't accessible to third-party apps)");
      throw new Error(`Spotify returned ${status} when fetching this playlist`);
    }

    // Replace existing tracks
    await supabase.from("playlist_tracks").delete().eq("playlist_id", pl.id);

    if (rows.length === 0) return { tracks: 0 };

    const tracksWithPlaylist = rows.map((row) => ({ ...row, playlist_id: pl.id }));
    const { error: insErr } = await supabase.from("playlist_tracks").insert(tracksWithPlaylist);
    if (insErr) {
      console.error("Insert single playlist tracks failed", insErr);
      throw new Error("Failed to save tracks");
    }
    return { tracks: rows.length };
  });
