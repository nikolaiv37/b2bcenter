-- Add commission_rate column to profiles table
-- This field stores the discount percentage (0-1) that applies to catalog prices for distributors
-- e.g., 0.15 = 15% discount on all products

-- Add the column
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5,4) DEFAULT 0 
CHECK (commission_rate >= 0 AND commission_rate <= 0.50);

-- Add a comment to describe the column
COMMENT ON COLUMN profiles.commission_rate IS 'Discount percentage (0-0.50) applied to catalog prices for this distributor. e.g., 0.15 = 15% off';

-- Create an index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Create a security definer function to check if current user is admin
-- This function bypasses RLS and won't cause recursion
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role 
    FROM public.profiles 
    WHERE id = auth.uid();
    
    RETURN user_role = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Drop any problematic policies that may have been created
DROP POLICY IF EXISTS "Admins can view all company profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update company profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can delete company profiles" ON profiles;

-- Ensure basic policies exist (these don't cause recursion)
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

-- Now create admin policies using the security definer function (no recursion)
CREATE POLICY "Admins can view all profiles"
    ON profiles FOR SELECT
    USING (public.is_admin());

CREATE POLICY "Admins can update all profiles"
    ON profiles FOR UPDATE
    USING (public.is_admin());

CREATE POLICY "Admins can delete company profiles"
    ON profiles FOR DELETE
    USING (public.is_admin());











