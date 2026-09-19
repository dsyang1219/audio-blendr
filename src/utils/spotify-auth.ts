/**
 * Spotify OAuth helpers: redirect-origin allowlisting and a signed `state`
 * parameter.
 *
 * The `state` value round-trips through Spotify and comes back to
 * `/api/spotify/callback`, which persists tokens for `state.userId` with a
 * service-role client. Because that write bypasses RLS, the callback must be
 * able to trust the user id it receives — so the state is HMAC-SHA256 signed
 * with a server-only secret and carries an issued-at timestamp. Anything
 * unsigned, tampered with, or older than STATE_TTL_MS is rejected.
 *
 * Uses Web Crypto so it runs identically on Node and Cloudflare Workers.
 */

const STATE_TTL_MS = 10 * 60 * 1000;

export interface SpotifyStatePayload {
  userId: string;
  returnOrigin: string;
  nonce: string;
  iat: number;
}

export class SpotifyStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SpotifyStateError";
  }
}

// ---------------------------------------------------------------------------
// Origins
// ---------------------------------------------------------------------------

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

/** The canonical public origin of this deployment, e.g. https://audioblendr.app */
export function getSpotifyAppOrigin(): string {
  const origin = readEnv("SPOTIFY_APP_ORIGIN");
  if (!origin) {
    throw new Error("SPOTIFY_APP_ORIGIN is not set — see .env.example");
  }
  return new URL(origin).origin;
}

export function getSpotifyRedirectUri(): string {
  return `${getSpotifyAppOrigin()}/api/spotify/callback`;
}

/**
 * Origins the callback may redirect back to after auth. Always includes the
 * app origin; extra entries (preview deployments, localhost) come from the
 * comma-separated SPOTIFY_ALLOWED_RETURN_ORIGINS env var.
 */
export function getAllowedReturnOrigins(): Set<string> {
  const allowed = new Set<string>([getSpotifyAppOrigin()]);
  for (const raw of readEnv("SPOTIFY_ALLOWED_RETURN_ORIGINS")?.split(",") ?? []) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    try {
      allowed.add(new URL(trimmed).origin);
    } catch {
      console.warn(
        `[spotify-auth] Ignoring invalid origin in SPOTIFY_ALLOWED_RETURN_ORIGINS: "${trimmed}"`,
      );
    }
  }
  return allowed;
}

/** Collapse any caller-supplied origin to an allowlisted one (open-redirect guard). */
export function normalizeSpotifyReturnOrigin(origin?: string | null): string {
  const fallback = getSpotifyAppOrigin();
  if (!origin) return fallback;
  try {
    const normalized = new URL(origin).origin;
    return getAllowedReturnOrigins().has(normalized) ? normalized : fallback;
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Signed state
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(input: string): Uint8Array<ArrayBuffer> {
  const padded = input
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(input.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function getStateSecret(): string {
  // A dedicated secret is preferred; the Spotify client secret is an
  // acceptable fallback because it is already server-only.
  const secret = readEnv("SPOTIFY_STATE_SECRET") ?? readEnv("SPOTIFY_CLIENT_SECRET");
  if (!secret) throw new Error("SPOTIFY_STATE_SECRET (or SPOTIFY_CLIENT_SECRET) is not set");
  return secret;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/** Build a signed, base64url `payload.signature` state string. */
export async function createSpotifyState(
  userId: string,
  returnOrigin?: string | null,
  now: number = Date.now(),
): Promise<string> {
  const payload: SpotifyStatePayload = {
    userId,
    returnOrigin: normalizeSpotifyReturnOrigin(returnOrigin),
    nonce: crypto.randomUUID(),
    iat: now,
  };
  const encodedPayload = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const key = await importHmacKey(getStateSecret());
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(encodedPayload)),
  );
  return `${encodedPayload}.${base64UrlEncode(signature)}`;
}

/**
 * Verify and decode a state string. Throws SpotifyStateError on any failure so
 * callers can distinguish a bad state from unrelated errors.
 */
export async function parseSpotifyState(
  state: string,
  now: number = Date.now(),
): Promise<Pick<SpotifyStatePayload, "userId" | "returnOrigin">> {
  const dot = state.indexOf(".");
  if (dot <= 0 || dot === state.length - 1) throw new SpotifyStateError("Malformed Spotify state");

  const encodedPayload = state.slice(0, dot);
  const encodedSignature = state.slice(dot + 1);

  let signature: Uint8Array<ArrayBuffer>;
  try {
    signature = base64UrlDecode(encodedSignature);
  } catch {
    throw new SpotifyStateError("Malformed Spotify state signature");
  }

  const key = await importHmacKey(getStateSecret());
  // crypto.subtle.verify is constant-time, so no manual timing-safe compare needed.
  const valid = await crypto.subtle.verify("HMAC", key, signature, encoder.encode(encodedPayload));
  if (!valid) throw new SpotifyStateError("Spotify state signature mismatch");

  let parsed: unknown;
  try {
    parsed = JSON.parse(decoder.decode(base64UrlDecode(encodedPayload)));
  } catch {
    throw new SpotifyStateError("Spotify state payload is not valid JSON");
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    typeof (parsed as SpotifyStatePayload).userId !== "string" ||
    typeof (parsed as SpotifyStatePayload).iat !== "number"
  ) {
    throw new SpotifyStateError("Spotify state payload is missing required fields");
  }

  const payload = parsed as SpotifyStatePayload;
  if (now - payload.iat > STATE_TTL_MS || payload.iat > now + 60_000) {
    throw new SpotifyStateError("Spotify state has expired");
  }

  return {
    userId: payload.userId,
    returnOrigin: normalizeSpotifyReturnOrigin(payload.returnOrigin),
  };
}
