import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Music, Youtube, Library } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate({ to: "/library" });
    }
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="container mx-auto flex items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <Music className="h-7 w-7 text-primary" />
          <h1 className="text-xl font-bold">Tunemix</h1>
        </div>
        <div className="flex gap-2">
          <Link to="/auth">
            <Button variant="ghost">Sign in</Button>
          </Link>
          <Link to="/auth">
            <Button>Get started</Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-6 py-20">
        <section className="mx-auto max-w-3xl text-center">
          <h2 className="text-5xl font-bold tracking-tight md:text-6xl">
            Your <span className="text-primary">Spotify library</span>,
            <br />playing on YouTube.
          </h2>
          <p className="mt-6 text-lg text-muted-foreground">
            Connect your Spotify account, sync your liked songs and playlists, and stream every track via YouTube — all in one beautiful player.
          </p>
          <div className="mt-10 flex justify-center gap-3">
            <Link to="/auth">
              <Button size="lg" className="text-base">Get started — it's free</Button>
            </Link>
          </div>
        </section>

        <section className="mx-auto mt-24 grid max-w-4xl gap-6 md:grid-cols-3">
          <FeatureCard icon={<Music className="h-6 w-6" />} title="Connect Spotify" desc="Link your Spotify account in one click to access your library." />
          <FeatureCard icon={<Library className="h-6 w-6" />} title="Sync everything" desc="Import liked songs and playlists with track metadata and artwork." />
          <FeatureCard icon={<Youtube className="h-6 w-6" />} title="Play via YouTube" desc="Stream every song from YouTube — no Spotify Premium required." />
        </section>
      </main>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}
