import { describe, expect, it } from "vitest";
import {
  buildYouTubeQuery,
  buildYouTubeQueryLadder,
  cleanTrackTitle,
  parseIsoDuration,
} from "@/utils/youtube.server";

describe("parseIsoDuration", () => {
  it.each([
    ["PT3M42S", 222],
    ["PT1H2M3S", 3723],
    ["PT45S", 45],
    ["PT2H", 7200],
    ["PT10M", 600],
    ["PT0S", 0],
  ])("parses %s -> %i seconds", (iso, seconds) => {
    expect(parseIsoDuration(iso)).toBe(seconds);
  });

  it.each(["", "3:42", "P1D", "PT", "PT3M42", "1H2M3S", "PT1.5M"])(
    "returns null for unsupported input %j",
    (iso) => {
      expect(parseIsoDuration(iso)).toBeNull();
    },
  );
});

describe("cleanTrackTitle", () => {
  it.each([
    ["Bohemian Rhapsody - Remastered 2011", "Bohemian Rhapsody"],
    ["Bohemian Rhapsody (Remastered)", "Bohemian Rhapsody"],
    ["Blinding Lights (feat. Someone)", "Blinding Lights"],
    ["Blinding Lights (ft. Someone)", "Blinding Lights"],
    ["Levitating - Radio Version", "Levitating"],
    ["Levitating (Club Remix)", "Levitating"],
  ])("strips noise suffix from %j", (input, expected) => {
    expect(cleanTrackTitle(input)).toBe(expected);
  });

  it("leaves titles without a recognised suffix untouched", () => {
    expect(cleanTrackTitle("Mr. Brightside")).toBe("Mr. Brightside");
    expect(cleanTrackTitle("Song (Live)")).toBe("Song (Live)");
  });

  it("never returns an empty query when the whole title looks like a suffix", () => {
    expect(cleanTrackTitle("(Remix)")).toBe("(Remix)");
    expect(cleanTrackTitle("  - Remastered  ")).toBe("- Remastered");
  });
});

describe("buildYouTubeQuery", () => {
  it("formats as artist - clean title", () => {
    expect(buildYouTubeQuery("Queen", "Bohemian Rhapsody - Remastered 2011")).toBe(
      "Queen - Bohemian Rhapsody",
    );
  });
});

describe("buildYouTubeQueryLadder", () => {
  it("orders queries from most to least specific", () => {
    expect(buildYouTubeQueryLadder("Queen", "Bohemian Rhapsody (Remastered)")).toEqual([
      "Queen - Bohemian Rhapsody",
      "Queen Bohemian Rhapsody audio",
      "Queen Bohemian Rhapsody (Remastered)",
      "Bohemian Rhapsody",
    ]);
  });

  it("drops duplicate rungs when the title needs no cleaning", () => {
    const ladder = buildYouTubeQueryLadder("The Killers", "Mr. Brightside");
    expect(ladder).toEqual([
      "The Killers - Mr. Brightside",
      "The Killers Mr. Brightside audio",
      "The Killers Mr. Brightside",
      "Mr. Brightside",
    ]);
    expect(new Set(ladder).size).toBe(ladder.length);
  });
});
