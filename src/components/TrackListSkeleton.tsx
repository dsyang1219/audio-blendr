import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder rows matching TrackList's layout, shown while tracks load. */
export function TrackListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="glass overflow-hidden rounded-2xl" aria-busy="true" aria-label="Loading tracks">
      <div className="border-b border-border/60 px-4 py-2.5">
        <Skeleton className="h-3 w-24" />
      </div>
      <ul>
        {Array.from({ length: rows }, (_, i) => (
          <li
            key={i}
            className="grid grid-cols-[2rem_1fr_3rem_2rem] items-center gap-3 border-b border-border/30 px-3 py-2.5 last:border-b-0 md:grid-cols-[3rem_1fr_1fr_4rem_2.5rem] md:gap-4 md:px-4"
          >
            <Skeleton className="mx-auto h-3 w-4" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 flex-shrink-0 rounded-md" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-[55%]" />
                <Skeleton className="h-3 w-[35%]" />
              </div>
            </div>
            <Skeleton className="hidden h-3 w-[60%] md:block" />
            <Skeleton className="ml-auto h-3 w-8" />
            <span className="hidden md:block" />
          </li>
        ))}
      </ul>
    </div>
  );
}
