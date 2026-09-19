-- =============================================
-- TRACK MATCHES: shared (artist, title) -> YouTube video cache
--
-- YouTube search.list costs 100 of the 10,000 daily quota units, so a match
-- found for one user is worth keeping for everyone. Rows hold no personal
-- data — only which video was found for which song.
--
-- Security model: every signed-in user may READ the cache, but there are
-- deliberately no INSERT / UPDATE / DELETE policies. Only the service role
-- (server functions, after performing a real YouTube search) can write, so
-- no user can point a popular song at an arbitrary video for everyone else.
-- =============================================
CREATE TABLE public.track_matches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  -- normalize_match_key(artist, title) as computed in src/utils/youtube.server.ts
  match_key TEXT NOT NULL UNIQUE,
  artist TEXT NOT NULL,
  title TEXT NOT NULL,
  spotify_track_id TEXT,
  youtube_video_id TEXT NOT NULL CHECK (youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  hit_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_track_matches_spotify
  ON public.track_matches(spotify_track_id)
  WHERE spotify_track_id IS NOT NULL;

ALTER TABLE public.track_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can read shared matches"
ON public.track_matches FOR SELECT
TO authenticated
USING (true);

CREATE TRIGGER update_track_matches_updated_at
BEFORE UPDATE ON public.track_matches
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Fire-and-forget hit counter, callable by the service role only.
CREATE OR REPLACE FUNCTION public.bump_track_match(_id UUID)
RETURNS VOID
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.track_matches SET hit_count = hit_count + 1 WHERE id = _id;
$$;

REVOKE EXECUTE ON FUNCTION public.bump_track_match(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bump_track_match(UUID) TO service_role;
