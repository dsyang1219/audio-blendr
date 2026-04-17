import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Music, Youtube, Library } from "lucide-react";

function OwlIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      {/* Ear tufts */}
      <path d="M7 7 L4.5 3 L8.5 5.5 Z" fill="currentColor" />
      <path d="M25 7 L27.5 3 L23.5 5.5 Z" fill="currentColor" />
      {/* Body/head silhouette - rounded owl shape */}
      <path
        d="M16 4c-5.5 0-9 3.5-9 8v6c0 4.5 4 8 9 8s9-3.5 9-8v-6c0-4.5-3.5-8-9-8z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      {/* Facial disc / brow line between eyes */}
      <path d="M16 9 v6" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
      {/* Big owl eyes - white rings */}
      <circle cx="11.5" cy="13" r="3.2" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="20.5" cy="13" r="3.2" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.3" />
      {/* Pupils */}
      <circle cx="11.5" cy="13" r="1.4" fill="currentColor" />
      <circle cx="20.5" cy="13" r="1.4" fill="currentColor" />
      {/* Beak - triangular */}
      <path d="M16 16 L14.5 18.5 L17.5 18.5 Z" fill="currentColor" />
      {/* Wing hints */}
      <path d="M8 18 Q9 22 11 23" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.7" />
      <path d="M24 18 Q23 22 21 23" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.7" />
      {/* Feet */}
      <path d="M13 25.5 v1.5 M14 25.5 v1.5 M15 25.5 v1.5" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" />
      <path d="M17 25.5 v1.5 M18 25.5 v1.5 M19 25.5 v1.5" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" />
    </svg>
  );
}
import { Logo } from "@/components/Logo";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { user } = useAuth();
  const ctaTo = user ? "/library" : "/auth";

  return (
    <div className="relative min-h-screen overflow-hidden text-foreground">
      <div className="absolute inset-0 -z-10 bg-gradient-mesh" />
      <header className="container mx-auto flex items-center justify-between px-6 py-6">
        <Link to="/" className="block">
          <Logo size="md" />
        </Link>
        <div className="flex gap-2">
          {user ? (
            <Link to="/library"><Button variant="secondary">Open library</Button></Link>
          ) : (
            <>
              <Link to="/auth"><Button variant="ghost">Sign in</Button></Link>
              <Link to="/auth"><Button variant="secondary" className="hover:scale-105 transition-all">Get started</Button></Link>
            </>
          )}
        </div>
      </header>

      <main className="container mx-auto px-6 py-20">
        <section className="mx-auto max-w-3xl text-center animate-fade-in">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs font-medium">
            <OwlIcon className="h-5 w-5 text-primary" />
            Built for Maddy
          </div>
          <h2 className="text-5xl font-bold tracking-tight md:text-7xl">
            Your <span className="text-gradient">Spotify library</span>,
            <br />playing on YouTube.
          </h2>
          <p className="mt-6 text-lg text-muted-foreground md:text-xl">
            Connect your Spotify account, sync your liked songs and playlists, and stream every track via YouTube — all in one player.
          </p>
          <div className="mt-10 flex justify-center gap-3">
            <Link to={ctaTo}>
              <Button size="lg" variant="secondary" className="text-base hover:scale-105 transition-all">
                {user ? "Open your library" : "Get started — it's free"}
              </Button>
            </Link>
          </div>
        </section>

        <section className="mx-auto mt-24 grid max-w-4xl gap-6 md:grid-cols-3">
          <FeatureCard icon={<Music className="h-6 w-6" />} title="Connect Spotify" desc="Link your Spotify account in one click to access your library." />
          <FeatureCard icon={<Library className="h-6 w-6" />} title="Sync everything" desc="Import liked songs and playlists with just the click of a button." />
          <FeatureCard icon={<Youtube className="h-6 w-6" />} title="Play via YouTube" desc="Stream every song from YouTube — no Spotify Premium required." />
        </section>
      </main>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="hover-lift glass rounded-2xl p-6 animate-scale-in">
      <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
        {icon}
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}
