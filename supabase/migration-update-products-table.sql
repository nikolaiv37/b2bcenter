-- Migration: Update products table to match CSV import structure
-- This updates the products table to match the megapap.csv format

-- Drop the old products table if you want to start fresh (CAUTION: This deletes all data!)
-- Uncomment the line below ONLY if you want to start from scratch
-- DROP TABLE IF EXISTS products CASCADE;

-- Create new products table with the correct structure
CREATE TABLE IF NOT EXISTS products (
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_products_supplier_id ON products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_manufacturer ON products(manufacturer);
CREATE INDEX IF NOT EXISTS idx_products_is_visible ON products(is_visible);

-- Create updated_at trigger if it doesn't exist
CREATE OR REPLACE FUNCTION update_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS products_updated_at_trigger ON products;
CREATE TRIGGER products_updated_at_trigger
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_products_updated_at();

-- Row Level Security (RLS)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Anyone can view visible products" ON products;
DROP POLICY IF EXISTS "Authenticated users can insert products" ON products;
DROP POLICY IF EXISTS "Suppliers can update their own products" ON products;
DROP POLICY IF EXISTS "Suppliers can delete their own products" ON products;
DROP POLICY IF EXISTS "Anyone can view products" ON products;
DROP POLICY IF EXISTS "Users can insert products in their company" ON products;
DROP POLICY IF EXISTS "Users can update products in their company" ON products;
DROP POLICY IF EXISTS "Users can delete products in their company" ON products;

-- Allow anyone to view visible products (or all products for dev mode)
CREATE POLICY "Anyone can view visible products"
    ON products FOR SELECT
    USING (is_visible = true OR supplier_id::text = COALESCE(auth.uid()::text, ''));

-- Allow authenticated users to insert products (or anyone for dev mode)
CREATE POLICY "Authenticated users can insert products"
    ON products FOR INSERT
    WITH CHECK (true); -- Allow all inserts for MVP/dev mode

-- Allow suppliers to update their own products (or anyone for dev mode)
CREATE POLICY "Suppliers can update their own products"
    ON products FOR UPDATE
    USING (true); -- Allow all updates for MVP/dev mode

-- Allow suppliers to delete their own products (or anyone for dev mode)
CREATE POLICY "Suppliers can delete their own products"
    ON products FOR DELETE
    USING (true); -- Allow all deletes for MVP/dev mode

-- Grant necessary permissions
GRANT ALL ON products TO authenticated;
GRANT SELECT ON products TO anon;

