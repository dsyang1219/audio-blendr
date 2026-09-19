import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TRACK_SORT_LABELS, type TrackSort } from "@/lib/track-filter";

interface TrackListToolbarProps {
  query: string;
  onQueryChange: (q: string) => void;
  sort: TrackSort;
  onSortChange: (s: TrackSort) => void;
  /** Visible / total, shown when a filter is active. */
  shown: number;
  total: number;
}

export function TrackListToolbar({
  query,
  onQueryChange,
  sort,
  onSortChange,
  shown,
  total,
}: TrackListToolbarProps) {
  return (
    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Filter by title, artist or album"
          aria-label="Filter tracks"
          className="bg-background/40 pl-9 pr-9"
        />
        {query && (
          <button
            type="button"
            onClick={() => onQueryChange("")}
            aria-label="Clear filter"
            className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        {query && (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {shown} of {total}
          </span>
        )}
        <Select value={sort} onValueChange={(v) => onSortChange(v as TrackSort)}>
          <SelectTrigger className="w-[150px] bg-background/40" aria-label="Sort tracks">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(TRACK_SORT_LABELS) as TrackSort[]).map((key) => (
              <SelectItem key={key} value={key}>
                {TRACK_SORT_LABELS[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
