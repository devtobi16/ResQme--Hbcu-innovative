-- Add transcript column to alerts table for storing speech-to-text results
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS transcript TEXT;

-- Add is_enabled column to emergency_contacts for enable/disable toggle
ALTER TABLE public.emergency_contacts ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN DEFAULT true;

-- Add duration_seconds column to alerts for storing recording duration
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;
