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
        <linearGradient id={gradA} x1="0" y1="20" x2="40" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="oklch(0.8 0.16 245)" />
          <stop offset="100%" stopColor="oklch(0.72 0.18 250)" />
        </linearGradient>
        <linearGradient id={gradB} x1="0" y1="20" x2="40" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="oklch(0.72 0.18 250)" />
          <stop offset="100%" stopColor="oklch(0.6 0.22 305)" />
        </linearGradient>
      </defs>
      {/* Left wave bars — cool blue side of the blend */}
      <rect x="6"  y="16" width="3" height="8"  rx="1.5" fill={`url(#${gradA})`} />
      <rect x="11" y="11" width="3" height="18" rx="1.5" fill={`url(#${gradA})`} />
      <rect x="16" y="6"  width="3" height="28" rx="1.5" fill={`url(#${gradA})`} />
      {/* Right wave bars — blue→red blend */}
      <rect x="21" y="6"  width="3" height="28" rx="1.5" fill={`url(#${gradB})`} />
      <rect x="26" y="11" width="3" height="18" rx="1.5" fill={`url(#${gradB})`} />
      <rect x="31" y="16" width="3" height="8"  rx="1.5" fill={`url(#${gradB})`} />
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
