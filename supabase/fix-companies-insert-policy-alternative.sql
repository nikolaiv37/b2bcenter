-- Alternative fix: More explicit RLS policy for companies INSERT
-- Run this if the other script doesn't work

-- Drop all existing policies on companies
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'companies') 
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON companies';
    END LOOP;
END $$;

-- Make sure RLS is enabled
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- Create SELECT policy (users can view their own company)
CREATE POLICY "Users can view their own company"
    ON companies FOR SELECT
    USING (
        id IN (
            SELECT company_id FROM profiles
            WHERE id = auth.uid() AND company_id IS NOT NULL
        )
        OR auth.uid() IS NOT NULL  -- Allow viewing during onboarding
    );

-- Create INSERT policy (allow any authenticated user to create a company)
CREATE POLICY "Authenticated users can insert companies"
    ON companies FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() IS NOT NULL);

-- Create UPDATE policy (users can update their own company)
CREATE POLICY "Users can update their own company"
    ON companies FOR UPDATE
    USING (
        id IN (
            SELECT company_id FROM profiles
            WHERE id = auth.uid() AND role = 'admin' AND company_id IS NOT NULL
        )
    );

-- Verify all policies
SELECT 
    policyname,
    cmd,
    roles,
    with_check
FROM pg_policies 
WHERE tablename = 'companies'
ORDER BY cmd, policyname;

