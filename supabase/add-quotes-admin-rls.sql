-- Add admin RLS policy to allow admins to see all orders (quotes table)
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
DROP POLICY IF EXISTS "Admins can view all quotes" ON quotes;
DROP POLICY IF EXISTS "Admins can update all quotes" ON quotes;

-- Policy: Admins can view all quotes/orders
CREATE POLICY "Admins can view all quotes"
    ON quotes FOR SELECT
    USING (public.is_user_admin());

-- Policy: Admins can update all quotes/orders
CREATE POLICY "Admins can update all quotes"
    ON quotes FOR UPDATE
    USING (public.is_user_admin())
    WITH CHECK (public.is_user_admin());

-- Note: The existing policies for regular users remain unchanged:
-- - "Users can view their own quotes" (for company users)
-- - "Users can insert their own quotes" (for company users)
-- - "Users can update their own quotes" (for company users)

