-- Wishlist Items Table
-- Wishlist is per-user, persisted forever, survives catalog re-uploads (uses SKU)

CREATE TABLE IF NOT EXISTS wishlist_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL,
    product_sku TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, product_sku)
);

-- Note: Foreign key to auth.users is not used here because:
-- 1. RLS policies already enforce user access control
-- 2. Allows dev mode to work with mock users
-- 3. User deletion is handled by application logic if needed

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_wishlist_items_user_id ON wishlist_items(user_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_items_product_sku ON wishlist_items(product_sku);

-- Enable Row Level Security
ALTER TABLE wishlist_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own wishlist items
CREATE POLICY "Users can view their own wishlist items"
    ON wishlist_items FOR SELECT
    USING (user_id = auth.uid() OR user_id = '00000000-0000-0000-0000-000000000123'::uuid);

-- Users can insert their own wishlist items
CREATE POLICY "Users can insert their own wishlist items"
    ON wishlist_items FOR INSERT
    WITH CHECK (user_id = auth.uid() OR user_id = '00000000-0000-0000-0000-000000000123'::uuid);

-- Users can delete their own wishlist items
CREATE POLICY "Users can delete their own wishlist items"
    ON wishlist_items FOR DELETE
    USING (user_id = auth.uid() OR user_id = '00000000-0000-0000-0000-000000000123'::uuid);

-- Enable realtime for wishlist_items
ALTER PUBLICATION supabase_realtime ADD TABLE wishlist_items;

