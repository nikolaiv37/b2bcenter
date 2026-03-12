-- Fix: Change supplier_id from UUID to TEXT
-- This allows using any text value (like 'dev-user-123') instead of requiring UUID format

-- Step 1: Drop all policies that reference supplier_id
DROP POLICY IF EXISTS "Anyone can view visible products" ON products;
DROP POLICY IF EXISTS "Authenticated users can insert products" ON products;
DROP POLICY IF EXISTS "Suppliers can update their own products" ON products;
DROP POLICY IF EXISTS "Suppliers can delete their own products" ON products;
DROP POLICY IF EXISTS "Anyone can view products" ON products;
DROP POLICY IF EXISTS "Users can insert products in their company" ON products;
DROP POLICY IF EXISTS "Users can update products in their company" ON products;
DROP POLICY IF EXISTS "Users can delete products in their company" ON products;

-- Step 2: Remove foreign key constraint if it exists
ALTER TABLE products 
DROP CONSTRAINT IF EXISTS products_supplier_id_fkey;

-- Step 3: Change supplier_id column type from UUID to TEXT
-- This will allow any text value, including 'dev-user-123'
ALTER TABLE products 
ALTER COLUMN supplier_id TYPE TEXT USING supplier_id::text;

-- Step 4: Recreate the policies (now with TEXT type)
CREATE POLICY "Anyone can view visible products"
    ON products FOR SELECT
    USING (is_visible = true OR supplier_id = COALESCE(auth.uid()::text, ''));

CREATE POLICY "Authenticated users can insert products"
    ON products FOR INSERT
    WITH CHECK (true); -- Allow all inserts for MVP/dev mode

CREATE POLICY "Suppliers can update their own products"
    ON products FOR UPDATE
    USING (true); -- Allow all updates for MVP/dev mode

CREATE POLICY "Suppliers can delete their own products"
    ON products FOR DELETE
    USING (true); -- Allow all deletes for MVP/dev mode

-- Step 5: Verify the change
-- Run this to check: SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'supplier_id';

