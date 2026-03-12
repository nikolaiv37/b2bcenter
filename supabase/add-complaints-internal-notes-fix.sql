-- Add internal_notes column to complaints table if it doesn't exist
-- Run this in Supabase SQL Editor if you see: column complaints.internal_notes does not exist

ALTER TABLE public.complaints 
ADD COLUMN IF NOT EXISTS internal_notes TEXT;

COMMENT ON COLUMN public.complaints.internal_notes IS 'Internal notes visible only to admins, not shown to customers';
