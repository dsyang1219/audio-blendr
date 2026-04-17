import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Music, Youtube, Library, Bird } from "lucide-react";
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
            <Bird className="h-3.5 w-3.5 text-primary" />
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
