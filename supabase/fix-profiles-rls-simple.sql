-- Simple fix for infinite recursion in profiles RLS policies
-- This version works even if company_id doesn't exist or is named differently

-- Step 1: Drop the problematic policy
DROP POLICY IF EXISTS "Users can view profiles in their company" ON profiles;

-- Step 2: Create a simple policy that allows users to view their own profile
-- This prevents recursion because it's a direct check, no subqueries
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
CREATE POLICY "Users can view their own profile"
    ON profiles FOR SELECT
    USING (id = auth.uid());

-- Step 3: Allow users to insert their own profile (for first-time login)
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile"
    ON profiles FOR INSERT
    WITH CHECK (id = auth.uid());

-- Step 4: Update the trigger function to use 'company' role
-- Note: profiles table doesn't have email column, only: id, role, company_name, phone, created_at
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, role)
    VALUES (NEW.id, 'company');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 5: Update role constraint if it exists
DO $$
BEGIN
    ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
    ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'company'));
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Could not update role constraint: %', SQLERRM;
END $$;

-- Note: If you need users to view other profiles in their company,
-- you'll need to add that policy separately after confirming company_id exists.
-- For now, this fixes the infinite recursion and allows login to work.

