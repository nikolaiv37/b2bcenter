-- Add target_role column to tenant_invitations
-- Distinguishes client invites ('company') from team/admin invites ('admin').
-- Default 'company' preserves backward compatibility for all existing rows.

ALTER TABLE public.tenant_invitations
  ADD COLUMN IF NOT EXISTS target_role TEXT NOT NULL DEFAULT 'company';

-- Add CHECK constraint (separate statement for IF NOT EXISTS safety)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tenant_invitations_target_role_check'
  ) THEN
    ALTER TABLE public.tenant_invitations
      ADD CONSTRAINT tenant_invitations_target_role_check
      CHECK (target_role IN ('admin', 'company'));
  END IF;
END $$;
