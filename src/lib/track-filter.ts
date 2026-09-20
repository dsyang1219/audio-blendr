export type TrackSort = "default" | "title" | "artist" | "album" | "duration";

export const TRACK_SORT_LABELS: Record<TrackSort, string> = {
  default: "Date added",
  title: "Title",
  artist: "Artist",
  album: "Album",
  duration: "Duration",
};

interface SortableTrack {
  title: string;
  artist: string;
  album?: string | null;
  duration_seconds?: number | null;
}

const collate = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base" });

/**
 * Case-insensitive substring filter over title / artist / album, then a stable
 * sort. Always returns a new array; never mutates the input.
 */
export function filterAndSortTracks<T extends SortableTrack>(
  tracks: readonly T[],
  query: string,
  sort: TrackSort,
): T[] {
  const q = query.trim().toLowerCase();
  const out = q
    ? tracks.filter((t) =>
        [t.title, t.artist, t.album ?? ""].some((v) => v.toLowerCase().includes(q)),
      )
    : [...tracks];

  switch (sort) {
    case "title":
      out.sort((a, b) => collate(a.title, b.title));
      break;
    case "artist":
      out.sort((a, b) => collate(a.artist, b.artist) || collate(a.title, b.title));
      break;
    case "album":
      // Tracks without an album sort last.
      out.sort((a, b) => collate(a.album ?? "￿", b.album ?? "￿") || collate(a.title, b.title));
      break;
    case "duration":
      out.sort((a, b) => (b.duration_seconds ?? 0) - (a.duration_seconds ?? 0));
      break;
    case "default":
      break;
  }
  return out;
}
