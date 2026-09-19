import type { ReactNode } from "react";
import { ListMusic, X } from "lucide-react";
import { usePlayer } from "@/lib/player-context";
import { Artwork } from "@/components/Artwork";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/** Slide-over showing what's playing and what's up next. `children` is the trigger. */
export function QueuePanel({ children }: { children: ReactNode }) {
  const { queue, currentIndex, current, jumpTo, removeFromQueue, clearQueue } = usePlayer();
  const upNext = currentIndex >= 0 ? queue.slice(currentIndex + 1) : queue;
  const upNextOffset = currentIndex >= 0 ? currentIndex + 1 : 0;

  return (
    <Sheet>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border/60 px-5 py-4 text-left">
          <SheetTitle className="flex items-center gap-2">
            <ListMusic className="h-4 w-4" /> Queue
          </SheetTitle>
          <SheetDescription>
            {queue.length === 0
              ? "Nothing queued."
              : `${upNext.length} up next · ${queue.length} total`}
          </SheetDescription>
        </SheetHeader>

        {queue.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-sm text-muted-foreground">
            <ListMusic className="h-8 w-8" />
            Play a song or playlist and it'll show up here.
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <div className="px-3 py-4">
              {current && (
                <>
                  <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                    Now playing
                  </p>
                  <QueueRow track={current} active />
                </>
              )}
              {upNext.length > 0 && (
                <>
                  <p className="mb-2 mt-5 px-2 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                    Up next
                  </p>
                  <ul>
                    {upNext.map((t, i) => (
                      <li key={`${t.id}-${upNextOffset + i}`}>
                        <QueueRow
                          track={t}
                          onPlay={() => jumpTo(upNextOffset + i)}
                          onRemove={() => removeFromQueue(upNextOffset + i)}
                        />
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </ScrollArea>
        )}

        {queue.length > 0 && (
          <div className="border-t border-border/60 p-3">
            <Button variant="ghost" size="sm" className="w-full" onClick={clearQueue}>
              Clear queue
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function QueueRow({
  track,
  active,
  onPlay,
  onRemove,
}: {
  track: { title: string; artist: string; album_art_url?: string | null };
  active?: boolean;
  onPlay?: () => void;
  onRemove?: () => void;
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-lg px-2 py-2",
        active ? "bg-primary/10" : "hover:bg-accent/40",
      )}
    >
      <button
        type="button"
        onClick={onPlay}
        disabled={!onPlay}
        className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-default"
      >
        <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-md bg-muted">
          <Artwork src={track.album_art_url} />
        </div>
        <div className="min-w-0">
          <div className={cn("truncate text-sm font-medium", active && "text-primary")}>
            {track.title}
          </div>
          <div className="truncate text-xs text-muted-foreground">{track.artist}</div>
        </div>
      </button>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${track.title} from queue`}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
