import { describe, expect, it } from "vitest";
import { filterAndSortTracks } from "@/lib/track-filter";

const tracks = [
  { id: "1", title: "Cruel Summer", artist: "Taylor Swift", album: "Lover", duration_seconds: 178 },
  {
    id: "2",
    title: "anti-hero",
    artist: "Taylor Swift",
    album: "Midnights",
    duration_seconds: 200,
  },
  { id: "3", title: "Heat Waves", artist: "Glass Animals", album: null, duration_seconds: 238 },
  {
    id: "4",
    title: "Blinding Lights",
    artist: "The Weeknd",
    album: "After Hours",
    duration_seconds: null,
  },
];

const ids = (list: { id: string }[]) => list.map((t) => t.id);

describe("filterAndSortTracks", () => {
  it("returns everything in original order by default", () => {
    expect(ids(filterAndSortTracks(tracks, "", "default"))).toEqual(["1", "2", "3", "4"]);
  });

  it("never mutates the input", () => {
    const copy = [...tracks];
    filterAndSortTracks(tracks, "", "title");
    expect(tracks).toEqual(copy);
  });

  it("filters case-insensitively across title, artist and album", () => {
    expect(ids(filterAndSortTracks(tracks, "TAYLOR", "default"))).toEqual(["1", "2"]);
    expect(ids(filterAndSortTracks(tracks, "midnights", "default"))).toEqual(["2"]);
    expect(ids(filterAndSortTracks(tracks, "  waves ", "default"))).toEqual(["3"]);
    expect(ids(filterAndSortTracks(tracks, "nope", "default"))).toEqual([]);
  });

  it("sorts by title ignoring case", () => {
    expect(ids(filterAndSortTracks(tracks, "", "title"))).toEqual(["2", "4", "1", "3"]);
  });

  it("sorts by artist, then title", () => {
    expect(ids(filterAndSortTracks(tracks, "", "artist"))).toEqual(["3", "2", "1", "4"]);
  });

  it("sorts by album with missing albums last", () => {
    expect(ids(filterAndSortTracks(tracks, "", "album"))).toEqual(["4", "1", "2", "3"]);
  });

  it("sorts by duration longest first, treating unknown as zero", () => {
    expect(ids(filterAndSortTracks(tracks, "", "duration"))).toEqual(["3", "2", "1", "4"]);
  });

  it("applies filter before sort", () => {
    expect(ids(filterAndSortTracks(tracks, "taylor", "title"))).toEqual(["2", "1"]);
  });
});
