import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { getSpotifyAppOrigin, getSpotifyRedirectUri, normalizeSpotifyReturnOrigin, parseSpotifyState } from "@/utils/spotify-auth";

const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_API = "https://api.spotify.com/v1";

export const Route = createFileRoute("/api/spotify/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const spotifyError = url.searchParams.get("error");

        let returnOrigin = getSpotifyAppOrigin();
        let userId: string | null = null;

        if (state) {
          try {
            const parsedState = parseSpotifyState(state);
            returnOrigin = parsedState.returnOrigin;
            userId = parsedState.userId;
          } catch (error) {
            console.error("Invalid Spotify callback state", error);
          }
        }

        if (spotifyError || !code || !userId) {
          if (spotifyError) {
            console.error("Spotify callback error", spotifyError);
          }
          return Response.redirect(`${normalizeSpotifyReturnOrigin(returnOrigin)}/connect`, 302);
        }

        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const clientId = process.env.SPOTIFY_CLIENT_ID;
        const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

        if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !clientId || !clientSecret) {
          console.error("Spotify callback missing server configuration");
          return Response.redirect(`${returnOrigin}/connect`, 302);
        }

        const supabaseAdmin = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
          auth: {
            storage: undefined,
            persistSession: false,
            autoRefreshToken: false,
          },
        });

        const body = new URLSearchParams({
          grant_type: "authorization_code",
          code,
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
          console.error("Spotify token exchange failed", tokenRes.status, await tokenRes.text());
          return Response.redirect(`${returnOrigin}/connect`, 302);
        }

        const tok = (await tokenRes.json()) as {
          access_token: string;
          refresh_token: string;
          expires_in: number;
          scope: string;
        };

        const meRes = await fetch(`${SPOTIFY_API}/me`, {
          headers: { Authorization: `Bearer ${tok.access_token}` },
        });
        const me = meRes.ok ? ((await meRes.json()) as { id: string; display_name?: string }) : null;

        const expiresAt = new Date(Date.now() + tok.expires_in * 1000).toISOString();
        const { error } = await supabaseAdmin.from("spotify_connections").upsert(
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
          console.error("Failed to save Spotify connection from callback", error);
        }

        return Response.redirect(`${returnOrigin}/connect`, 302);
      },
    },
  },
});