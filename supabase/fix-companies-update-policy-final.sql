-- Final fix for UPDATE policy on companies table
-- This ensures users can update their company during onboarding
-- Run this in your Supabase SQL editor

-- Drop existing UPDATE policy
DROP POLICY IF EXISTS "Users can update their own company" ON companies;

-- Create UPDATE policy that allows users to update their own company
-- This works for both admins and regular users (during onboarding)
-- The key is: if user has company_id in profile that matches, they can update
CREATE POLICY "Users can update their own company"
    ON companies FOR UPDATE
    USING (
        -- Allow if user's profile has this company_id
        id IN (
            SELECT company_id 
            FROM profiles 
            WHERE id = auth.uid() 
            AND company_id IS NOT NULL
        )
    )
    WITH CHECK (
        -- Same check for WITH CHECK clause
        id IN (
            SELECT company_id 
            FROM profiles 
            WHERE id = auth.uid() 
            AND company_id IS NOT NULL
        )
    );

-- Also ensure SELECT policy allows viewing during update
-- (needed for .select() after update)
DROP POLICY IF EXISTS "Users can view their own company" ON companies;

CREATE POLICY "Users can view their own company"
    ON companies FOR SELECT
    USING (
        id IN (
            SELECT company_id FROM profiles
            WHERE id = auth.uid() AND company_id IS NOT NULL
        )
        OR auth.uid() IS NOT NULL  -- Allow authenticated users to view (needed during onboarding)
    );

-- Verify the policies
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    roles,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'companies'
ORDER BY cmd, policyname;

