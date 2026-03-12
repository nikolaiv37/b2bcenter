-- Fix RLS policies and foreign key for complaints table to allow dev mode
-- Run this if you're getting RLS or foreign key constraint errors

-- First, drop the foreign key constraint (it prevents dev mode from working)
ALTER TABLE complaints 
DROP CONSTRAINT IF EXISTS complaints_user_id_fkey;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own complaints" ON complaints;
DROP POLICY IF EXISTS "Users can insert their own complaints" ON complaints;
DROP POLICY IF EXISTS "Users can update pending complaints" ON complaints;

-- Create permissive insert policy that works in dev mode
-- Allows inserts when:
-- 1. user_id matches auth.uid() (normal authenticated case), OR
-- 2. auth.uid() is NULL (dev mode - allows any insert), OR
-- 3. user_id matches dev user ID
CREATE POLICY "Users can insert their own complaints"
    ON complaints FOR INSERT
    WITH CHECK (
        (auth.uid() IS NOT NULL AND user_id = auth.uid())
        OR auth.uid() IS NULL
        OR user_id = '00000000-0000-0000-0000-000000000123'::uuid
    );

-- Create permissive select policy
CREATE POLICY "Users can view their own complaints"
    ON complaints FOR SELECT
    USING (
        (auth.uid() IS NOT NULL AND user_id = auth.uid())
        OR auth.uid() IS NULL
        OR user_id = '00000000-0000-0000-0000-000000000123'::uuid
    );

-- Create update policy
CREATE POLICY "Users can update pending complaints"
    ON complaints FOR UPDATE
    USING (
        (
            (auth.uid() IS NOT NULL AND user_id = auth.uid())
            OR auth.uid() IS NULL
            OR user_id = '00000000-0000-0000-0000-000000000123'::uuid
        )
        AND status = 'pending'
    )
    WITH CHECK (
        (
            (auth.uid() IS NOT NULL AND user_id = auth.uid())
            OR auth.uid() IS NULL
            OR user_id = '00000000-0000-0000-0000-000000000123'::uuid
        )
        AND status = 'pending'
    );

-- Grant permissions
GRANT ALL ON complaints TO authenticated;
GRANT INSERT, SELECT ON complaints TO anon;

