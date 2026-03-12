-- Optimization: Add indexes to improve category filtering performance
-- Run this after the category migration is complete

-- Index for products.category_id lookups (already exists from add-category-id-to-products.sql)
-- This is a reminder that it should exist:
-- CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);

-- Index for categories.parent_id to speed up hierarchy queries
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);

-- Index for categories.slug for URL-based lookups
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);

-- Composite index for products visibility + category_id (common query pattern)
CREATE INDEX IF NOT EXISTS idx_products_visible_category 
  ON products(is_visible, category_id) 
  WHERE is_visible = true;

-- Analyze tables to update statistics for the query planner
ANALYZE products;
ANALYZE categories;

