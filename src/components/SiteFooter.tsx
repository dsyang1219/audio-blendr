import { Link } from "@tanstack/react-router";
import { Github } from "lucide-react";
import { cn } from "@/lib/utils";
import { SITE_NAME, SITE_REPO_URL } from "@/lib/site";

/**
 * Compact footer used on the marketing, auth and legal pages. The app shell
 * has its own inline variant in the sidebar (see routes/_app.tsx).
 */
export function SiteFooter({ className }: { className?: string }) {
  const year = new Date().getFullYear();
  return (
    <footer
      className={cn(
        "container mx-auto flex flex-col items-center gap-3 px-6 py-8 text-xs text-muted-foreground md:flex-row md:justify-between",
        className,
      )}
    >
      <p>
        © {year} {SITE_NAME}. Not affiliated with Spotify or YouTube.
      </p>
      <nav aria-label="Legal" className="flex items-center gap-4">
        <Link to="/privacy" className="transition-colors hover:text-foreground">
          Privacy
        </Link>
        <Link to="/terms" className="transition-colors hover:text-foreground">
          Terms
        </Link>
        <a
          href={SITE_REPO_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
        >
          <Github className="h-3.5 w-3.5" aria-hidden="true" />
          Source
        </a>
      </nav>
    </footer>
  );
}
