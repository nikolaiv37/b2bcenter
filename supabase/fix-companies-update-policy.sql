-- Fix UPDATE policy for companies to allow updates during onboarding
-- Run this in your Supabase SQL editor

-- Drop existing UPDATE policy
DROP POLICY IF EXISTS "Users can update their own company" ON companies;

-- Create UPDATE policy that allows users to update their own company
-- This allows both admins and regular users (during onboarding) to update
CREATE POLICY "Users can update their own company"
    ON companies FOR UPDATE
    USING (
        id IN (
            SELECT company_id FROM profiles
            WHERE id = auth.uid() 
            AND company_id IS NOT NULL
        )
    )
    WITH CHECK (
        id IN (
            SELECT company_id FROM profiles
            WHERE id = auth.uid() 
            AND company_id IS NOT NULL
        )
    );

-- Verify the policy was created
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'companies' AND cmd = 'UPDATE'
ORDER BY policyname;

