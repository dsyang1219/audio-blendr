import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createSpotifyState,
  getAllowedReturnOrigins,
  getSpotifyAppOrigin,
  getSpotifyRedirectUri,
  normalizeSpotifyReturnOrigin,
  parseSpotifyState,
  SpotifyStateError,
} from "@/utils/spotify-auth";

const APP_ORIGIN = "https://audioblendr.example";
const USER_ID = "8c0d5f3e-1b2a-4c3d-9e8f-0a1b2c3d4e5f";

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env.SPOTIFY_APP_ORIGIN = APP_ORIGIN;
  process.env.SPOTIFY_STATE_SECRET = "test-state-secret";
  delete process.env.SPOTIFY_ALLOWED_RETURN_ORIGINS;
  delete process.env.SPOTIFY_CLIENT_SECRET;
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("origin configuration", () => {
  it("derives the redirect URI from SPOTIFY_APP_ORIGIN", () => {
    expect(getSpotifyAppOrigin()).toBe(APP_ORIGIN);
    expect(getSpotifyRedirectUri()).toBe(`${APP_ORIGIN}/api/spotify/callback`);
  });

  it("normalizes a URL with a path down to its origin", () => {
    process.env.SPOTIFY_APP_ORIGIN = `${APP_ORIGIN}/some/path?x=1`;
    expect(getSpotifyAppOrigin()).toBe(APP_ORIGIN);
  });

  it("fails loudly when SPOTIFY_APP_ORIGIN is missing", () => {
    delete process.env.SPOTIFY_APP_ORIGIN;
    expect(() => getSpotifyAppOrigin()).toThrow(/SPOTIFY_APP_ORIGIN/);
  });

  it("always allowlists the app origin and parses extra origins", () => {
    process.env.SPOTIFY_ALLOWED_RETURN_ORIGINS =
      " http://localhost:8080 , https://preview.example/with/path,not-a-url,, ";
    expect([...getAllowedReturnOrigins()]).toEqual([
      APP_ORIGIN,
      "http://localhost:8080",
      "https://preview.example",
    ]);
  });
});

describe("normalizeSpotifyReturnOrigin (open-redirect guard)", () => {
  it("returns the app origin for empty input", () => {
    expect(normalizeSpotifyReturnOrigin(undefined)).toBe(APP_ORIGIN);
    expect(normalizeSpotifyReturnOrigin(null)).toBe(APP_ORIGIN);
    expect(normalizeSpotifyReturnOrigin("")).toBe(APP_ORIGIN);
  });

  it("collapses an allowlisted URL to its origin", () => {
    process.env.SPOTIFY_ALLOWED_RETURN_ORIGINS = "http://localhost:8080";
    expect(normalizeSpotifyReturnOrigin("http://localhost:8080/connect?tab=1")).toBe(
      "http://localhost:8080",
    );
  });

  it("rejects origins that are not allowlisted", () => {
    expect(normalizeSpotifyReturnOrigin("https://evil.example")).toBe(APP_ORIGIN);
    expect(normalizeSpotifyReturnOrigin("https://audioblendr.example.evil.example")).toBe(
      APP_ORIGIN,
    );
  });

  it("rejects unparseable input", () => {
    expect(normalizeSpotifyReturnOrigin("javascript:alert(1)")).toBe(APP_ORIGIN);
    expect(normalizeSpotifyReturnOrigin("//evil.example")).toBe(APP_ORIGIN);
    expect(normalizeSpotifyReturnOrigin("garbage")).toBe(APP_ORIGIN);
  });
});

describe("signed OAuth state", () => {
  it("round-trips userId and an allowlisted return origin", async () => {
    process.env.SPOTIFY_ALLOWED_RETURN_ORIGINS = "http://localhost:8080";
    const state = await createSpotifyState(USER_ID, "http://localhost:8080/connect");
    expect(state).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);

    const parsed = await parseSpotifyState(state);
    expect(parsed).toEqual({ userId: USER_ID, returnOrigin: "http://localhost:8080" });
  });

  it("falls back to the app origin when the requested return origin is not allowlisted", async () => {
    const state = await createSpotifyState(USER_ID, "https://evil.example");
    expect((await parseSpotifyState(state)).returnOrigin).toBe(APP_ORIGIN);
  });

  it("produces a fresh nonce per call", async () => {
    const [a, b] = await Promise.all([createSpotifyState(USER_ID), createSpotifyState(USER_ID)]);
    expect(a).not.toBe(b);
  });

  it("rejects a state whose payload was tampered with", async () => {
    // Attack scenario: swap in a victim's userId while keeping the signature.
    const state = await createSpotifyState(USER_ID);
    const [payload, signature] = state.split(".");
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString());
    decoded.userId = "00000000-0000-0000-0000-000000000000";
    const forged = `${Buffer.from(JSON.stringify(decoded)).toString("base64url")}.${signature}`;

    await expect(parseSpotifyState(forged)).rejects.toBeInstanceOf(SpotifyStateError);
    await expect(parseSpotifyState(forged)).rejects.toThrow(/signature mismatch/);
  });

  it("rejects the legacy unsigned JSON format", async () => {
    const legacy = JSON.stringify({ userId: USER_ID, returnOrigin: APP_ORIGIN, nonce: "x" });
    await expect(parseSpotifyState(legacy)).rejects.toBeInstanceOf(SpotifyStateError);
  });

  it.each(["", ".", "abc", "abc.", ".abc", "not base64!.sig"])(
    "rejects malformed input %j",
    async (input) => {
      await expect(parseSpotifyState(input)).rejects.toBeInstanceOf(SpotifyStateError);
    },
  );

  it("rejects a state signed with a different secret", async () => {
    const state = await createSpotifyState(USER_ID);
    process.env.SPOTIFY_STATE_SECRET = "rotated-secret";
    await expect(parseSpotifyState(state)).rejects.toThrow(/signature mismatch/);
  });

  it("rejects a state older than its TTL", async () => {
    const issuedAt = 1_700_000_000_000;
    const state = await createSpotifyState(USER_ID, null, issuedAt);

    await expect(parseSpotifyState(state, issuedAt + 9 * 60_000)).resolves.toBeTruthy();
    await expect(parseSpotifyState(state, issuedAt + 11 * 60_000)).rejects.toThrow(/expired/);
  });

  it("rejects a state issued unreasonably far in the future", async () => {
    const now = 1_700_000_000_000;
    const state = await createSpotifyState(USER_ID, null, now + 5 * 60_000);
    await expect(parseSpotifyState(state, now)).rejects.toThrow(/expired/);
  });

  it("falls back to SPOTIFY_CLIENT_SECRET when no dedicated state secret is set", async () => {
    delete process.env.SPOTIFY_STATE_SECRET;
    process.env.SPOTIFY_CLIENT_SECRET = "client-secret";
    const state = await createSpotifyState(USER_ID);
    await expect(parseSpotifyState(state)).resolves.toMatchObject({ userId: USER_ID });
  });

  it("fails loudly when no signing secret is configured", async () => {
    delete process.env.SPOTIFY_STATE_SECRET;
    await expect(createSpotifyState(USER_ID)).rejects.toThrow(/SPOTIFY_STATE_SECRET/);
  });
});
