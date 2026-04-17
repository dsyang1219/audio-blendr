import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * Audio Blendr brand mark — two interlocking sound waves forming a "blend".
 * Renders as an inline SVG so it inherits color and scales crisply.
 * Uses useId() so multiple instances on the same page don't collide on gradient IDs.
 */
export function LogoMark({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, "");
  const gradA = `ab-grad-a-${uid}`;
  const gradB = `ab-grad-b-${uid}`;
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-full w-full", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradA} x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="oklch(0.8 0.16 245)" />
          <stop offset="100%" stopColor="oklch(0.6 0.22 305)" />
        </linearGradient>
        <linearGradient id={gradB} x1="0" y1="0" x2="0" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="oklch(0.95 0.02 250)" />
          <stop offset="100%" stopColor="oklch(0.85 0.08 250)" />
        </linearGradient>
      </defs>
      {/* Ear tufts */}
      <path d="M8 10 L11 4 L14 11 Z" fill={`url(#${gradA})`} />
      <path d="M32 10 L29 4 L26 11 Z" fill={`url(#${gradA})`} />
      {/* Body / head — single rounded owl silhouette */}
      <path
        d="M20 6 C28 6 33 12 33 20 C33 29 27 35 20 35 C13 35 7 29 7 20 C7 12 12 6 20 6 Z"
        fill={`url(#${gradA})`}
      />
      {/* Eye discs */}
      <circle cx="14.5" cy="18" r="4.5" fill={`url(#${gradB})`} />
      <circle cx="25.5" cy="18" r="4.5" fill={`url(#${gradB})`} />
      {/* Pupils */}
      <circle cx="14.5" cy="18" r="2" fill="oklch(0.18 0.04 260)" />
      <circle cx="25.5" cy="18" r="2" fill="oklch(0.18 0.04 260)" />
      {/* Eye shine */}
      <circle cx="15.3" cy="17.2" r="0.7" fill="oklch(1 0 0)" />
      <circle cx="26.3" cy="17.2" r="0.7" fill="oklch(1 0 0)" />
      {/* Beak */}
      <path d="M20 21 L18 24 L22 24 Z" fill="oklch(0.78 0.15 60)" />
      {/* Wing hint */}
      <path
        d="M11 24 Q13 30 18 31"
        stroke="oklch(0.4 0.1 270 / 0.5)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M29 24 Q27 30 22 31"
        stroke="oklch(0.4 0.1 270 / 0.5)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Logo({
  className,
  size = "md",
  showWordmark = true,
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
}) {
  const sizes = {
    sm: { box: "h-8 w-8", text: "text-base" },
    md: { box: "h-10 w-10", text: "text-xl" },
    lg: { box: "h-12 w-12", text: "text-2xl" },
  } as const;
  const s = sizes[size];

  return (
    <div className={cn("group flex items-center gap-2.5", className)}>
      <div
        className={cn(
          "relative flex items-center justify-center rounded-2xl bg-card/80 p-2 ring-1 ring-white/10 shadow-glow transition-transform group-hover:scale-105 group-hover:rotate-3",
          s.box,
        )}
      >
        <LogoMark />
      </div>
      {showWordmark && (
        <span className={cn("font-display font-bold tracking-tight text-gradient", s.text)}>
          Audio Blendr
        </span>
      )}
    </div>
  );
}
