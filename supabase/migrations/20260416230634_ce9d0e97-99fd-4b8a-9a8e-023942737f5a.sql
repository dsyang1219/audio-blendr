
-- Add a "source" to playlists/tracks so we know if it came from Spotify or YouTube
ALTER TABLE public.liked_tracks ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'spotify';
ALTER TABLE public.playlist_tracks ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'spotify';
ALTER TABLE public.playlists ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'spotify';

-- Allow users to add custom YouTube tracks (no spotify_track_id required)
-- Existing schema already allows this since both id columns are nullable.
