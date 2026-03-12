-- Migration: Update products table to match CSV import structure (SAFE VERSION)
-- This version handles both new tables and existing tables

-- Step 1: Drop old products table if it exists (CAUTION: This deletes all data!)
-- Uncomment ONLY if you want to start completely fresh
-- DROP TABLE IF EXISTS products CASCADE;

-- Step 2: Create products table if it doesn't exist, or alter if it does
DO $$
BEGIN
    -- Check if table exists
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'products') THEN
        -- Create new table
        CREATE TABLE products (
            id SERIAL PRIMARY KEY,
            supplier_id TEXT NOT NULL,
            model TEXT,
            sku TEXT NOT NULL UNIQUE,
            retail_price DECIMAL(10, 2),
            weboffer_price DECIMAL(10, 2) NOT NULL,
            name TEXT NOT NULL,
            name_bg TEXT,
            category TEXT,
            manufacturer TEXT,
            description TEXT,
            description_bg TEXT,
            availability TEXT DEFAULT 'In Stock',
            quantity INTEGER DEFAULT 0,
            weight DECIMAL(10, 4),
            transportational_weight DECIMAL(10, 4),
            date_expected TEXT,
            main_image TEXT,
            images TEXT[] DEFAULT '{}',
            is_visible BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    ELSE
        -- Table exists, add missing columns
        ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier_id TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS model TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS weboffer_price DECIMAL(10, 2);
        ALTER TABLE products ADD COLUMN IF NOT EXISTS name_bg TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS description_bg TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS manufacturer TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS availability TEXT DEFAULT 'In Stock';
        ALTER TABLE products ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 0;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS weight DECIMAL(10, 4);
        ALTER TABLE products ADD COLUMN IF NOT EXISTS transportational_weight DECIMAL(10, 4);
        ALTER TABLE products ADD COLUMN IF NOT EXISTS date_expected TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS main_image TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS is_visible BOOLEAN DEFAULT true;
        
        -- Migrate company_id to supplier_id if needed
        UPDATE products SET supplier_id = company_id::text WHERE supplier_id IS NULL AND company_id IS NOT NULL;
        
        -- Make supplier_id NOT NULL after migration
        ALTER TABLE products ALTER COLUMN supplier_id SET NOT NULL;
        
        -- Update SKU constraint (drop old, add new)
        ALTER TABLE products DROP CONSTRAINT IF EXISTS products_company_id_sku_key;
        IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'products_sku_unique'
              AND conrelid = 'products'::regclass
        ) THEN
            ALTER TABLE products ADD CONSTRAINT products_sku_unique UNIQUE (sku);
        END IF;
    END IF;
END $$;

-- Step 3: Create indexes
CREATE INDEX IF NOT EXISTS idx_products_supplier_id ON products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_manufacturer ON products(manufacturer);
CREATE INDEX IF NOT EXISTS idx_products_is_visible ON products(is_visible);

-- Step 4: Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create trigger
DROP TRIGGER IF EXISTS products_updated_at_trigger ON products;
CREATE TRIGGER products_updated_at_trigger
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_products_updated_at();

-- Step 6: Enable Row Level Security
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Step 7: Drop old policies if they exist
DROP POLICY IF EXISTS "Anyone can view visible products" ON products;
DROP POLICY IF EXISTS "Authenticated users can insert products" ON products;
DROP POLICY IF EXISTS "Suppliers can update their own products" ON products;
DROP POLICY IF EXISTS "Suppliers can delete their own products" ON products;
DROP POLICY IF EXISTS "Anyone can view products" ON products;
DROP POLICY IF EXISTS "Users can insert products in their company" ON products;
DROP POLICY IF EXISTS "Users can update products in their company" ON products;
DROP POLICY IF EXISTS "Users can delete products in their company" ON products;

-- Step 8: Create new policies
CREATE POLICY "Anyone can view visible products"
    ON products FOR SELECT
    USING (is_visible = true OR supplier_id = auth.uid()::text);

CREATE POLICY "Authenticated users can insert products"
    ON products FOR INSERT
    WITH CHECK (auth.uid()::text = supplier_id);

CREATE POLICY "Suppliers can update their own products"
    ON products FOR UPDATE
    USING (auth.uid()::text = supplier_id);

CREATE POLICY "Suppliers can delete their own products"
    ON products FOR DELETE
    USING (auth.uid()::text = supplier_id);

-- Step 9: Grant permissions
GRANT ALL ON products TO authenticated;
GRANT SELECT ON products TO anon;
