const DEFAULT_SPOTIFY_APP_ORIGIN = "https://audio-blendr.lovable.app";

const ALLOWED_RETURN_ORIGINS = new Set([
  "https://audio-blendr.lovable.app",
  "https://id-preview--061365d6-309a-4437-9d98-8815ec9ee58d.lovable.app",
  "https://061365d6-309a-4437-9d98-8815ec9ee58d.lovableproject.com",
]);

export function getSpotifyAppOrigin() {
  return process.env.SPOTIFY_APP_ORIGIN ?? DEFAULT_SPOTIFY_APP_ORIGIN;
}

export function getSpotifyRedirectUri() {
  return `${getSpotifyAppOrigin()}/api/spotify/callback`;
}

export function normalizeSpotifyReturnOrigin(origin?: string | null) {
  if (!origin) return getSpotifyAppOrigin();

  try {
    const normalized = new URL(origin).origin;
    return ALLOWED_RETURN_ORIGINS.has(normalized) ? normalized : getSpotifyAppOrigin();
  } catch {
    return getSpotifyAppOrigin();
  }
}

export function createSpotifyState(userId: string, returnOrigin?: string | null) {
  return JSON.stringify({
    userId,
    returnOrigin: normalizeSpotifyReturnOrigin(returnOrigin),
    nonce: crypto.randomUUID(),
  });
}

export function parseSpotifyState(state: string) {
  let parsed: unknown;

  try {
    parsed = JSON.parse(state);
  } catch {
    throw new Error("Invalid Spotify state");
  }

  if (!parsed || typeof parsed !== "object" || !("userId" in parsed) || typeof parsed.userId !== "string") {
    throw new Error("Invalid Spotify state");
  }

  return {
    userId: parsed.userId,
    returnOrigin:
      "returnOrigin" in parsed && typeof parsed.returnOrigin === "string"
        ? normalizeSpotifyReturnOrigin(parsed.returnOrigin)
        : getSpotifyAppOrigin(),
  };
}