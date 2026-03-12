-- Fix wishlist_items table: Remove foreign key constraint to allow dev mode
-- Run this if you already created the table with the foreign key constraint

-- Drop the foreign key constraint if it exists
DO $$ 
BEGIN
    -- Check if the constraint exists and drop it
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'wishlist_items_user_id_fkey'
        AND table_name = 'wishlist_items'
    ) THEN
        ALTER TABLE wishlist_items DROP CONSTRAINT wishlist_items_user_id_fkey;
    END IF;
END $$;

-- Note: Foreign key to auth.users is not used here because:
-- 1. RLS policies already enforce user access control
-- 2. Allows dev mode to work with mock users
-- 3. User deletion is handled by application logic if needed

