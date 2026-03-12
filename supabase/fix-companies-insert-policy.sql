-- Fix RLS policy for companies table to allow inserts during onboarding
-- Run this in your Supabase SQL editor

-- First, let's see what policies currently exist
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
WHERE tablename = 'companies'
ORDER BY policyname;

-- Drop ALL existing INSERT policies on companies (to avoid conflicts)
DROP POLICY IF EXISTS "Users can insert their own company" ON companies;
DROP POLICY IF EXISTS "Authenticated users can insert companies" ON companies;
DROP POLICY IF EXISTS "Allow company creation during onboarding" ON companies;

-- Make sure RLS is enabled
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- Create a single, clear INSERT policy that allows authenticated users to create companies
-- This is needed for onboarding flow before the user has a company_id
-- Using WITH CHECK (true) allows any authenticated user to insert
CREATE POLICY "Authenticated users can insert companies"
    ON companies FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Update SELECT policy to also allow viewing companies during onboarding
-- (when user doesn't have company_id yet, but just created a company)
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

-- Verify the policies were created
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
WHERE tablename = 'companies'
ORDER BY policyname;
