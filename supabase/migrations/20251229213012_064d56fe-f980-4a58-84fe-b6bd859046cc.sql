-- Create storage bucket for emergency audio recordings
INSERT INTO storage.buckets (id, name, public) 
VALUES ('emergency-recordings', 'emergency-recordings', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload their own recordings"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'emergency-recordings' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to read their own recordings
CREATE POLICY "Users can view their own recordings"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'emergency-recordings' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow edge functions to read recordings (for AI analysis)
CREATE POLICY "Service role can read all recordings"
ON storage.objects FOR SELECT
USING (bucket_id = 'emergency-recordings');