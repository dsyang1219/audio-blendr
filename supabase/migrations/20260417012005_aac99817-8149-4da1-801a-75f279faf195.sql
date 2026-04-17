DELETE FROM public.playlists 
WHERE source = 'spotify' 
  AND id NOT IN (SELECT DISTINCT playlist_id FROM public.playlist_tracks);