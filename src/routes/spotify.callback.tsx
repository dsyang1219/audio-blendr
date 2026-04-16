import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { completeSpotifyAuth } from "@/utils/spotify.functions";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/spotify/callback")({
  validateSearch: (search: Record<string, unknown>) => ({
    code: typeof search.code === "string" ? search.code : undefined,
    state: typeof search.state === "string" ? search.state : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  component: SpotifyCallback,
});

function SpotifyCallback() {
  const search = useSearch({ from: "/spotify/callback" });
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const completeFn = useServerFn(completeSpotifyAuth);
  const ranRef = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    if (ranRef.current) return;
    ranRef.current = true;

    if (search.error) {
      toast.error(`Spotify error: ${search.error}`);
      navigate({ to: "/connect" });
      return;
    }
    if (!search.code || !search.state) {
      toast.error("Missing Spotify response");
      navigate({ to: "/connect" });
      return;
    }

    completeFn({ data: { code: search.code, state: search.state, origin: window.location.origin } })
      .then((r) => {
        toast.success(`Connected as ${r.displayName ?? "Spotify user"}!`);
        navigate({ to: "/connect" });
      })
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : "Failed to complete Spotify auth");
        navigate({ to: "/connect" });
      });
  }, [search, user, loading, completeFn, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex items-center gap-3 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Completing Spotify connection…
      </div>
    </div>
  );
}
