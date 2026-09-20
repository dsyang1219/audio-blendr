import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";
import { LEGAL_LAST_UPDATED } from "@/lib/site";

/** Shared chrome for long-form legal documents. */
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="relative min-h-screen text-foreground">
      <div className="absolute inset-0 -z-10 bg-gradient-mesh" />
      <header className="container mx-auto flex items-center justify-between px-6 py-6">
        <Link to="/" className="block">
          <Logo size="md" />
        </Link>
        <nav aria-label="Legal documents" className="flex gap-4 text-sm text-muted-foreground">
          <Link to="/privacy" activeProps={{ className: "text-foreground" }}>
            Privacy
          </Link>
          <Link to="/terms" activeProps={{ className: "text-foreground" }}>
            Terms
          </Link>
        </nav>
      </header>

      <main className="container mx-auto px-6 pb-16">
        <article className="glass mx-auto max-w-3xl rounded-2xl p-6 md:p-10">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
          <p className="mt-2 text-xs text-muted-foreground">Last updated {LEGAL_LAST_UPDATED}</p>
          <div className="legal-prose mt-8">{children}</div>
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}
