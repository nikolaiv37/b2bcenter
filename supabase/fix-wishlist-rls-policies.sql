-- Fix RLS policies for wishlist_items to allow dev mode
-- Run this to update existing policies

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own wishlist items" ON wishlist_items;
DROP POLICY IF EXISTS "Users can insert their own wishlist items" ON wishlist_items;
DROP POLICY IF EXISTS "Users can delete their own wishlist items" ON wishlist_items;

-- Recreate policies with dev mode support
-- Users can view their own wishlist items (including dev user)
CREATE POLICY "Users can view their own wishlist items"
    ON wishlist_items FOR SELECT
    USING (user_id = auth.uid() OR user_id = '00000000-0000-0000-0000-000000000123'::uuid);

-- Users can insert their own wishlist items (including dev user)
CREATE POLICY "Users can insert their own wishlist items"
    ON wishlist_items FOR INSERT
    WITH CHECK (user_id = auth.uid() OR user_id = '00000000-0000-0000-0000-000000000123'::uuid);

-- Users can delete their own wishlist items (including dev user)
CREATE POLICY "Users can delete their own wishlist items"
    ON wishlist_items FOR DELETE
    USING (user_id = auth.uid() OR user_id = '00000000-0000-0000-0000-000000000123'::uuid);

