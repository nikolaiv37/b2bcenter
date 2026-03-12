-- FINAL fix for infinite recursion in profiles RLS policies
-- The issue: "Admin views all profiles" policy queries profiles table, causing recursion

-- Step 1: Drop ALL existing policies on profiles table (including the problematic admin one)
DROP POLICY IF EXISTS "Users can view profiles in their company" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Admin views all profiles" ON profiles;

-- Step 2: Create a SECURITY DEFINER function to check if user is admin
-- This bypasses RLS, preventing recursion
CREATE OR REPLACE FUNCTION public.is_user_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        SELECT role = 'admin' 
        FROM public.profiles 
        WHERE id = auth.uid()
        LIMIT 1
    ) = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Step 3: Create the essential policies (in correct order)

-- Policy 1: Users can view their own profile (NO recursion - direct check)
CREATE POLICY "Users can view their own profile"
    ON profiles FOR SELECT
    USING (id = auth.uid());

-- Policy 2: Admins can view all profiles (uses function to avoid recursion)
CREATE POLICY "Admins can view all profiles"
    ON profiles FOR SELECT
    USING (public.is_user_admin());

-- Policy 3: Users can update their own profile
CREATE POLICY "Users can update their own profile"
    ON profiles FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Policy 4: Users can insert their own profile (for first-time login)
CREATE POLICY "Users can insert their own profile"
    ON profiles FOR INSERT
    WITH CHECK (id = auth.uid());

-- Step 4: Update the trigger function to use 'company' role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, role)
    VALUES (NEW.id, 'company');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 5: Update role constraint
DO $$
BEGIN
    ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
    ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'company'));
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Could not update role constraint: %', SQLERRM;
END $$;

-- Step 6: Verify the policies were created correctly
SELECT 
    policyname,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY policyname;

