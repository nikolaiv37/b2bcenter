-- FIX: Remove infinite recursion in profiles RLS policies
-- Run this immediately if you see "infinite recursion detected in policy for relation profiles"

-- Step 1: Drop the problematic policies that caused recursion
DROP POLICY IF EXISTS "Admins can view all company profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update company profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can delete company profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

-- Step 2: Create a security definer function to check admin status
-- SECURITY DEFINER means this function runs with the privileges of the owner (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role 
    FROM public.profiles 
    WHERE id = auth.uid();
    
    RETURN COALESCE(user_role = 'admin', FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon;

-- Step 3: Ensure basic policies exist (simple id = auth.uid() checks don't cause recursion)
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
CREATE POLICY "Users can view their own profile"
    ON profiles FOR SELECT
    USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile"
    ON profiles FOR UPDATE
    USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile"
    ON profiles FOR INSERT
    WITH CHECK (id = auth.uid());

-- Step 4: Create admin policies using the function (no recursion because function is SECURITY DEFINER)
CREATE POLICY "Admins can view all profiles"
    ON profiles FOR SELECT
    USING (public.is_admin());

CREATE POLICY "Admins can update all profiles"
    ON profiles FOR UPDATE
    USING (public.is_admin());

CREATE POLICY "Admins can delete company profiles"
    ON profiles FOR DELETE
    USING (public.is_admin());

-- Step 5: Add commission_rate column if not exists
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5,4) DEFAULT 0;

-- Add constraint if column was just added
DO $$
BEGIN
    ALTER TABLE profiles ADD CONSTRAINT profiles_commission_rate_check 
    CHECK (commission_rate >= 0 AND commission_rate <= 0.50);
EXCEPTION
    WHEN duplicate_object THEN 
        NULL; -- Constraint already exists
END $$;

-- Create index for role filtering
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Done! Your app should work now.
SELECT 'Fix applied successfully! Refresh your browser.' AS status;











