-- Complete fix for infinite recursion in profiles RLS policies
-- This drops ALL existing policies and recreates them properly

-- Step 1: Drop ALL existing policies on profiles table
DROP POLICY IF EXISTS "Users can view profiles in their company" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;

-- Step 2: Create the essential policy FIRST - users can view their own profile
-- This MUST be first and must NOT reference the profiles table in its condition
CREATE POLICY "Users can view their own profile"
    ON profiles FOR SELECT
    USING (id = auth.uid());

-- Step 3: Allow users to update their own profile
CREATE POLICY "Users can update their own profile"
    ON profiles FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Step 4: Allow users to insert their own profile (for first-time login)
CREATE POLICY "Users can insert their own profile"
    ON profiles FOR INSERT
    WITH CHECK (id = auth.uid());

-- Step 5: Update the trigger function to use 'company' role
-- Note: profiles table has: id, role, company_name, phone, created_at (no email column)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, role)
    VALUES (NEW.id, 'company');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 6: Update role constraint if it exists
DO $$
BEGIN
    ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
    ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'company'));
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Could not update role constraint: %', SQLERRM;
END $$;

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
WHERE tablename = 'profiles'
ORDER BY policyname;

