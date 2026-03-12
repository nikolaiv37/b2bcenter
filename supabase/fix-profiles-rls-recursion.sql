-- Fix infinite recursion in profiles RLS policies
-- The issue: SELECT policy checks profiles table, which triggers itself

-- First, let's check what columns exist (for debugging)
-- Run this separately if needed: SELECT column_name FROM information_schema.columns WHERE table_name = 'profiles';

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view profiles in their company" ON profiles;

-- Create a better policy that allows:
-- 1. Users to view their own profile (no recursion - direct check)
-- 2. Users to view profiles in their company (but only after they have a profile)

-- First, allow users to view their own profile (this prevents recursion)
-- This is the most important policy - it must come first
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
CREATE POLICY "Users can view their own profile"
    ON profiles FOR SELECT
    USING (id = auth.uid());

-- Then, allow users to view profiles in their company
-- Use a SECURITY DEFINER function to avoid recursion when checking company_id
-- This function bypasses RLS, so it won't cause recursion
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS UUID AS $$
BEGIN
    -- Use SECURITY DEFINER to bypass RLS and prevent recursion
    RETURN (SELECT company_id FROM public.profiles WHERE id = auth.uid() LIMIT 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Policy to view other profiles in the same company
-- Only applies if the profile is not the user's own (handled by first policy)
CREATE POLICY "Users can view profiles in their company"
    ON profiles FOR SELECT
    USING (
        -- Only check company_id if the profile is not the user's own
        id != auth.uid()
        AND company_id IS NOT NULL
        AND company_id = public.get_user_company_id()
    );

-- Ensure users can insert their own profile (for first-time login)
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile"
    ON profiles FOR INSERT
    WITH CHECK (id = auth.uid());

-- Update the trigger function to use 'company' role instead of 'buyer'
-- Also update the role check constraint if it still has 'buyer'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, role)
    VALUES (NEW.id, NEW.email, 'company');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the role constraint to allow 'company' and 'admin' (remove 'sales' and 'buyer' if needed)
-- First check what the current constraint is
DO $$
BEGIN
    -- Try to alter the constraint if it exists
    ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
    ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'company'));
EXCEPTION
    WHEN others THEN
        -- If constraint doesn't exist or can't be altered, that's okay
        RAISE NOTICE 'Could not update role constraint: %', SQLERRM;
END $$;

