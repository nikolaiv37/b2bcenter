-- Add admin RLS policy to allow admins to see all complaints
-- This uses the is_user_admin() function to avoid recursion

-- First, ensure the is_user_admin() function exists (from fix-profiles-rls-final.sql)
-- If it doesn't exist, create it
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

-- Drop existing admin policy if it exists
DROP POLICY IF EXISTS "Admins can view all complaints" ON complaints;
DROP POLICY IF EXISTS "Admins can update all complaints" ON complaints;

-- Policy: Admins can view all complaints
CREATE POLICY "Admins can view all complaints"
    ON complaints FOR SELECT
    USING (public.is_user_admin());

-- Policy: Admins can update all complaints (not just pending ones)
CREATE POLICY "Admins can update all complaints"
    ON complaints FOR UPDATE
    USING (public.is_user_admin())
    WITH CHECK (public.is_user_admin());

-- Note: The existing policies for regular users remain unchanged:
-- - "Users can view their own complaints" (for company users)
-- - "Users can insert their own complaints" (for company users)
-- - "Users can update pending complaints" (for company users, only if pending)

