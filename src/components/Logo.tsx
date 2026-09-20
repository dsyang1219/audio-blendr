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
      {/* Left wave */}
      <path
        d="M6 20 Q12 8 18 20 T30 20"
        stroke={`url(#${gradA})`}
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      {/* Right wave (mirrored, offset) */}
      <path
        d="M10 20 Q16 32 22 20 T34 20"
        stroke={`url(#${gradB})`}
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
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
        <span
          className={cn(
            "whitespace-nowrap font-display font-bold tracking-tight text-gradient",
            s.text,
          )}
        >
          Audio Blendr
        </span>
      )}
    </div>
  );
}
