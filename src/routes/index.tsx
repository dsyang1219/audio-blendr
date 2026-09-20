import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Check,
  Heart,
  History,
  Link2,
  ListMusic,
  Lock,
  Pause,
  Play,
  Repeat,
  Search,
  Shuffle,
  SkipBack,
  SkipForward,
  Smartphone,
} from "lucide-react";
import owlIcon from "@/assets/owl-icon.png";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: Landing,
});

/** Rows for the hero mock-up: a playlist that mixes a streaming catalogue with songs that only exist online. */
const MOCK_TRACKS = [
  { title: "Cruel Summer", artist: "Taylor Swift", time: "2:58", source: "spotify", hue: 340 },
  {
    title: "Midnight City (Demo)",
    artist: "Unreleased · 2023",
    time: "4:12",
    source: "link",
    hue: 260,
  },
  { title: "Blinding Lights", artist: "The Weeknd", time: "3:20", source: "spotify", hue: 20 },
  {
    title: "Heat Waves — Live at Glastonbury",
    artist: "Glass Animals",
    time: "4:41",
    source: "link",
    hue: 300,
  },
  { title: "Kill Bill (Sped Up)", artist: "SZA · remix", time: "2:19", source: "link", hue: 200 },
] as const;

function Landing() {
  const { user } = useAuth();
  const ctaTo = user ? "/home" : "/auth";

  return (
    <div className="relative min-h-screen overflow-hidden text-foreground">
      <div className="absolute inset-0 -z-10 bg-gradient-mesh" />
      <header className="container mx-auto flex items-center justify-between px-6 py-6">
        <Link to="/" className="block">
          <Logo size="md" />
        </Link>
        <div className="flex gap-2">
          {user ? (
            <Link to="/home">
              <Button variant="secondary">Open app</Button>
            </Link>
          ) : (
            <>
              <Link to="/auth">
                <Button variant="ghost">Sign in</Button>
              </Link>
              <Link to="/auth">
                <Button variant="secondary" className="transition-all hover:scale-105">
                  Get started
                </Button>
              </Link>
            </>
          )}
        </div>
      </header>

      <main className="container mx-auto px-6">
        {/* ---- Hero ---------------------------------------------------- */}
        <section className="grid grid-cols-1 items-center gap-12 py-12 md:py-20 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          <div className="min-w-0 animate-fade-in">
            <div className="glass mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium">
              <img
                src={owlIcon}
                alt=""
                width={24}
                height={24}
                loading="lazy"
                className="h-6 w-6 object-contain"
              />
              For the songs that never made it to streaming
            </div>
            <h1 className="text-5xl font-bold leading-[1.05] tracking-tight md:text-6xl xl:text-7xl">
              Every song you love.
              <br />
              <span className="text-gradient">Even the ones Spotify doesn't have.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground md:text-xl">
              Unreleased tracks, live versions, remixes, covers — the music that only exists online,
              sitting in the same playlist as your Spotify library. One queue. One player.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Link to={ctaTo}>
                <Button
                  size="lg"
                  className="gap-2 text-base shadow-glow transition-all hover:scale-105"
                >
                  {user ? "Open your library" : "Get started — it's free"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <a
                href="#how-it-works"
                className="px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                See how it works
              </a>
            </div>
          </div>

          <HeroMock />
        </section>

        {/* ---- How it works ------------------------------------------- */}
        <section id="how-it-works" className="mx-auto max-w-5xl scroll-mt-24 py-16 md:py-24">
          <p className="text-center text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            How it works
          </p>
          <h2 className="mt-3 text-center text-3xl font-bold tracking-tight md:text-4xl">
            Three steps to one library
          </h2>
          <ol className="mt-12 grid gap-6 md:grid-cols-3">
            <Step
              n={1}
              icon={<Heart className="h-5 w-5" />}
              title="Bring your Spotify library"
              desc="Sync your liked songs and playlists in one click. Nothing is copied or re-hosted — just the metadata."
              note="Spotify limits new apps to a handful of accounts, so this part is currently invite-only."
            />
            <Step
              n={2}
              icon={<Link2 className="h-5 w-5" />}
              title="Add anything with a link"
              desc="That unreleased demo, the live version, the remix that isn't on any streaming service — paste a link and it's a song in your library like any other."
            />
            <Step
              n={3}
              icon={<Play className="h-5 w-5 fill-current" />}
              title="Play it all together"
              desc="Mix both in the same playlist. One queue, shuffle, repeat, keyboard shortcuts, lock-screen controls — on your laptop or your phone."
            />
          </ol>
        </section>

        {/* ---- Feature grid ------------------------------------------- */}
        <section className="mx-auto max-w-5xl pb-16 md:pb-24">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Feature icon={<ListMusic className="h-5 w-5" />} title="Playlists that mix sources">
              Reorder with drag-and-drop, upload cover art, add from Spotify search or a link — in
              the same list.
            </Feature>
            <Feature icon={<History className="h-5 w-5" />} title="A real home screen">
              Recently played, quick actions and your playlists the moment you sign in.
            </Feature>
            <Feature icon={<Search className="h-5 w-5" />} title="Find it instantly">
              Filter any library by title, artist or album, and sort by whatever you like. Play and
              shuffle respect the filter.
            </Feature>
            <Feature icon={<Shuffle className="h-5 w-5" />} title="A player, not a widget">
              Up-next queue, shuffle, repeat one / all, seek, volume — and it remembers where you
              were after a refresh.
            </Feature>
            <Feature icon={<Smartphone className="h-5 w-5" />} title="Built for your phone">
              Full-screen now-playing view and controls from your lock screen and headphones.
            </Feature>
            <Feature icon={<Lock className="h-5 w-5" />} title="Private by default">
              Your library is yours: row-level security on every table, and you can delete your
              account yourself in one click.
            </Feature>
          </div>
        </section>

        {/* ---- Final CTA ---------------------------------------------- */}
        <section className="mx-auto mb-8 max-w-4xl">
          <div className="glass relative overflow-hidden rounded-3xl px-8 py-12 text-center md:py-16">
            <div className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-[oklch(0.6_0.22_305)]/20 blur-3xl" />
            <h2 className="relative text-3xl font-bold tracking-tight md:text-4xl">
              Stop keeping two libraries.
            </h2>
            <p className="relative mx-auto mt-3 max-w-lg text-muted-foreground">
              Free, no Premium required, and your data stays yours.
            </p>
            <Link to={ctaTo} className="relative mt-8 inline-block">
              <Button
                size="lg"
                className="gap-2 text-base shadow-glow transition-all hover:scale-105"
              >
                {user ? "Open your library" : "Create your library"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

/** A static, CSS-only mock of a mixed-source playlist with the player bar. */
function HeroMock() {
  return (
    <div
      className="animate-scale-in relative mx-auto w-full min-w-0 max-w-md lg:max-w-none"
      aria-hidden="true"
    >
      <div className="pointer-events-none absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-primary/25 via-transparent to-[oklch(0.6_0.22_305)]/25 blur-2xl" />
      <div className="glass overflow-hidden rounded-2xl shadow-elegant ring-1 ring-white/10">
        <div className="flex items-end gap-4 bg-secondary/60 p-5">
          <div className="grid h-20 w-20 flex-shrink-0 grid-cols-2 gap-0.5 overflow-hidden rounded-xl shadow-elegant">
            {MOCK_TRACKS.slice(0, 4).map((t) => (
              <div
                key={t.title}
                style={{ background: `oklch(0.55 0.18 ${t.hue})` }}
                className="h-full w-full"
              />
            ))}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Playlist
            </p>
            <p className="truncate text-2xl font-bold tracking-tight">Late Night Drive</p>
            <p className="text-xs text-muted-foreground">5 songs · 2 you can't get on Spotify</p>
          </div>
        </div>
        <ul className="divide-y divide-border/40">
          {MOCK_TRACKS.map((t, i) => (
            <li
              key={t.title}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 text-sm",
                i === 1 && "bg-primary/10",
              )}
            >
              <span className="w-5 text-center text-xs text-muted-foreground">
                {i === 1 ? (
                  <span className="mx-auto block h-2 w-2 animate-pulse rounded-full bg-primary shadow-glow" />
                ) : (
                  i + 1
                )}
              </span>
              <div
                style={{ background: `oklch(0.5 0.16 ${t.hue})` }}
                className="h-9 w-9 flex-shrink-0 rounded-md"
              />
              <div className="min-w-0 flex-1">
                <div className={cn("truncate font-medium", i === 1 && "text-primary")}>
                  {t.title}
                </div>
                <div className="truncate text-xs text-muted-foreground">{t.artist}</div>
              </div>
              <SourcePill source={t.source} />
              <span className="w-9 text-right text-xs text-muted-foreground">{t.time}</span>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-3 border-t border-border/60 bg-sidebar/90 px-4 py-3">
          <div
            style={{ background: `oklch(0.5 0.16 ${MOCK_TRACKS[1].hue})` }}
            className="h-10 w-10 flex-shrink-0 rounded-lg"
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{MOCK_TRACKS[1].title}</div>
            <div className="truncate text-xs text-muted-foreground">{MOCK_TRACKS[1].artist}</div>
          </div>
          <div className="flex items-center gap-3 text-muted-foreground">
            <Shuffle className="h-3.5 w-3.5" />
            <SkipBack className="h-4 w-4" />
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-background">
              <Pause className="h-3.5 w-3.5" />
            </span>
            <SkipForward className="h-4 w-4" />
            <Repeat className="h-3.5 w-3.5 text-primary" />
          </div>
        </div>
        <div className="h-1 w-full bg-border/60">
          <div className="h-full w-[38%] rounded-r-full bg-gradient-to-r from-primary to-[oklch(0.6_0.22_305)]" />
        </div>
      </div>
    </div>
  );
}

function SourcePill({ source }: { source: "spotify" | "link" }) {
  return source === "spotify" ? (
    <span className="inline-flex items-center gap-1 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
      <Check className="h-2.5 w-2.5" /> Spotify
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-secondary-foreground">
      <Link2 className="h-2.5 w-2.5" /> Link
    </span>
  );
}

function Step({
  n,
  icon,
  title,
  desc,
  note,
}: {
  n: number;
  icon: ReactNode;
  title: string;
  desc: string;
  note?: string;
}) {
  return (
    <li className="glass hover-lift relative rounded-2xl p-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-glow">
          {icon}
        </span>
        <span className="font-mono text-xs text-muted-foreground">0{n}</span>
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-1.5 text-sm text-muted-foreground">{desc}</p>
      {note && <p className="mt-3 text-xs text-muted-foreground/70">{note}</p>}
    </li>
  );
}

function Feature({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="glass hover-lift rounded-2xl p-5">
      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
        {icon}
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{children}</p>
    </div>
  );
}
