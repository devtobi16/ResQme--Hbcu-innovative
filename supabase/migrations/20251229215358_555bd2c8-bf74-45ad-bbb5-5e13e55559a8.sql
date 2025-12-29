-- Add deleted_at column for soft delete with 30-day retention
ALTER TABLE public.alerts ADD COLUMN deleted_at timestamp with time zone DEFAULT NULL;

-- Create index for faster queries on non-deleted alerts
CREATE INDEX idx_alerts_deleted_at ON public.alerts(deleted_at) WHERE deleted_at IS NULL;

-- Update RLS policy to hide soft-deleted alerts from users
DROP POLICY IF EXISTS "Users can view their own alerts" ON public.alerts;
CREATE POLICY "Users can view their own alerts" 
ON public.alerts 
FOR SELECT 
USING (auth.uid() = user_id AND deleted_at IS NULL);

-- Create a function to purge old soft-deleted records (can be called by a cron job)
CREATE OR REPLACE FUNCTION public.purge_old_deleted_alerts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete alerts and their associated data that were soft-deleted more than 30 days ago
  DELETE FROM public.alerts 
  WHERE deleted_at IS NOT NULL 
  AND deleted_at < now() - interval '30 days';
END;
$$;