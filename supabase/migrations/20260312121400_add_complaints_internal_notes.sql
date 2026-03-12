-- Add internal_notes field to complaints table for admin-only notes
-- This field is only visible to admins and won't be shown to customers

ALTER TABLE complaints 
ADD COLUMN IF NOT EXISTS internal_notes TEXT;

-- Add comment to document the field
COMMENT ON COLUMN complaints.internal_notes IS 'Internal notes visible only to admins, not shown to customers';

