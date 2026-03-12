-- Fix RLS policies for quotes table to allow dev mode inserts
-- Run this if you're getting "new row violates row-level security policy" errors

-- Drop existing policies
DROP POLICY IF EXISTS "Users can insert their own quotes" ON quotes;
DROP POLICY IF EXISTS "Users can view their own quotes" ON quotes;
DROP POLICY IF EXISTS "Users can update their own quotes" ON quotes;

-- Create permissive insert policy that works in dev mode
-- Allows inserts when:
-- 1. user_id matches auth.uid() (normal authenticated case), OR
-- 2. auth.uid() is NULL (dev mode - allows any insert)
CREATE POLICY "Users can insert their own quotes"
    ON quotes FOR INSERT
    WITH CHECK (
        (auth.uid()::text IS NOT NULL AND user_id = auth.uid()::text)
        OR auth.uid()::text IS NULL
    );

-- Create permissive select policy
CREATE POLICY "Users can view their own quotes"
    ON quotes FOR SELECT
    USING (
        (auth.uid()::text IS NOT NULL AND user_id = auth.uid()::text)
        OR auth.uid()::text IS NULL
    );

-- Create update policy
CREATE POLICY "Users can update their own quotes"
    ON quotes FOR UPDATE
    USING (
        (auth.uid()::text IS NOT NULL AND user_id = auth.uid()::text)
        OR auth.uid()::text IS NULL
    )
    WITH CHECK (
        (auth.uid()::text IS NOT NULL AND user_id = auth.uid()::text)
        OR auth.uid()::text IS NULL
    );

-- Grant permissions
GRANT ALL ON quotes TO authenticated;
GRANT INSERT, SELECT ON quotes TO anon;

