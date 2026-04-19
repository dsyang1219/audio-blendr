ALTER TABLE public.playlists ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_playlists_user_sort ON public.playlists(user_id, sort_order);