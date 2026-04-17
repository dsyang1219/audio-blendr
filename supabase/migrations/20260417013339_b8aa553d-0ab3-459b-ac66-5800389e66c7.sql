
-- Create public bucket for playlist cover images
INSERT INTO storage.buckets (id, name, public)
VALUES ('playlist-covers', 'playlist-covers', true)
ON CONFLICT (id) DO NOTHING;

-- Public read
CREATE POLICY "Playlist covers are publicly viewable"
ON storage.objects
FOR SELECT
USING (bucket_id = 'playlist-covers');

-- Authenticated users can upload to their own folder (folder = their user id)
CREATE POLICY "Users can upload their own playlist covers"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'playlist-covers'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own playlist covers"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'playlist-covers'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own playlist covers"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'playlist-covers'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
