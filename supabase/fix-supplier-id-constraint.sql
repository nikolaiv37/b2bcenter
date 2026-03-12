-- Fix for dev mode: Remove foreign key constraint on supplier_id
-- This allows importing products without requiring the supplier_id to exist in auth.users

-- Drop the foreign key constraint if it exists
ALTER TABLE products 
DROP CONSTRAINT IF EXISTS products_supplier_id_fkey;

-- If supplier_id is UUID type, we can change it to TEXT to be more flexible
-- Uncomment the line below if you want to change the column type:
-- ALTER TABLE products ALTER COLUMN supplier_id TYPE TEXT;

-- For now, let's just remove the constraint so dev mode works
-- The supplier_id can be any text value (UUID or otherwise)

