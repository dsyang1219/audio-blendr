import { useEffect, useState } from "react";
import { Music } from "lucide-react";
import { cn } from "@/lib/utils";

interface ArtworkProps {
  src?: string | null;
  /** Accessible name. Leave empty for purely decorative art next to a text label. */
  alt?: string;
  className?: string;
  iconClassName?: string;
}

/**
 * Album / playlist artwork with a graceful fallback. Remote art URLs (Spotify
 * CDN, YouTube thumbnails, user uploads) do go stale, and a broken-image icon
 * looks worse than no art at all — so a failed load swaps to the placeholder.
 * The parent controls size and rounding; this fills it.
 */
export function Artwork({ src, alt = "", className, iconClassName }: ArtworkProps) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className={cn("h-full w-full object-cover", className)}
      />
    );
  }

  return (
    <div
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      className={cn(
        "flex h-full w-full items-center justify-center bg-secondary text-secondary-foreground",
        className,
      )}
    >
      <Music className={cn("h-[40%] w-[40%] max-h-6 max-w-6", iconClassName)} />
    </div>
  );
}
