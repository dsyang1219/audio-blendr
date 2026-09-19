import { describe, expect, it } from "vitest";
import { normalizeMatchKey, normalizeText, primaryArtist } from "@/utils/youtube.server";

describe("normalizeText", () => {
  it("lowercases, strips accents and punctuation, collapses whitespace", () => {
    expect(normalizeText("  Señorita!!  (Live) ")).toBe("senorita live");
    expect(normalizeText("Beyoncé")).toBe("beyonce");
    expect(normalizeText("Don't Stop Me Now")).toBe("dont stop me now");
    expect(normalizeText("Rock & Roll")).toBe("rock and roll");
  });
});

describe("primaryArtist", () => {
  it.each([
    ["The Weeknd, Daft Punk", "The Weeknd"],
    ["Post Malone; Swae Lee", "Post Malone"],
    ["Calvin Harris / Dua Lipa", "Calvin Harris"],
    ["Ed Sheeran feat. Beyoncé", "Ed Sheeran"],
    ["Silk Sonic ft Bruno Mars", "Silk Sonic"],
    ["Rihanna featuring Drake", "Rihanna"],
  ])("takes the lead artist from %j", (input, expected) => {
    expect(primaryArtist(input)).toBe(expected);
  });

  it("keeps ampersand duos intact", () => {
    expect(primaryArtist("Simon & Garfunkel")).toBe("Simon & Garfunkel");
  });

  it("falls back to the raw string when the separator is at the start", () => {
    expect(primaryArtist(", Oddly Formatted")).toBe(", Oddly Formatted");
  });
});

describe("normalizeMatchKey", () => {
  it("produces an artist|title key", () => {
    expect(normalizeMatchKey("The Weeknd", "Blinding Lights")).toBe("the weeknd|blinding lights");
  });

  it("collides the same recording across differently formatted libraries", () => {
    const a = normalizeMatchKey("The Weeknd", "Blinding Lights");
    expect(normalizeMatchKey("the weeknd, Daft Punk", "Blinding Lights - Remastered")).toBe(a);
    expect(normalizeMatchKey("THE WEEKND feat. Someone", "Blinding Lights (feat. Someone)")).toBe(
      a,
    );
    expect(normalizeMatchKey("The Weeknd", "Blinding   Lights!")).toBe(a);
  });

  it("keeps genuinely different songs apart", () => {
    expect(normalizeMatchKey("Taylor Swift", "Cruel Summer")).not.toBe(
      normalizeMatchKey("Taylor Swift", "Anti-Hero"),
    );
    expect(normalizeMatchKey("Taylor Swift", "Style")).not.toBe(
      normalizeMatchKey("Harry Styles", "Style"),
    );
  });

  it("does not collapse a live version into the studio version", () => {
    expect(normalizeMatchKey("Queen", "Bohemian Rhapsody (Live)")).not.toBe(
      normalizeMatchKey("Queen", "Bohemian Rhapsody"),
    );
  });
});
