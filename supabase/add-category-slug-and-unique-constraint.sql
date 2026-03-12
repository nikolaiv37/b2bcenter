-- Migration: Add slug column and unique constraint to categories table
-- This ensures:
-- 1. Each category has a URL-safe slug derived from its name
-- 2. No duplicate category names at the same level (same parent_id within same company)

-- Step 1: Add slug column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'categories'
      AND column_name = 'slug'
  ) THEN
    ALTER TABLE public.categories ADD COLUMN slug text;
  END IF;
END $$;

-- Step 2: Backfill slugs for existing categories
-- Slugify: lowercase, spaces to dashes, strip special chars
UPDATE public.categories
SET slug = lower(
  regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(trim(name), '\s+', '-', 'g'),  -- spaces to dashes
        '[^\w\-]', '', 'g'                             -- remove non-word chars except dashes
      ),
      '\-\-+', '-', 'g'                                -- collapse multiple dashes
    ),
    '^-+|-+$', '', 'g'                                 -- trim leading/trailing dashes
  )
)
WHERE slug IS NULL OR slug = '';

-- Step 3: Create unique constraint on (company_id, parent_id, name)
-- This prevents duplicate category names at the same level
-- Using a partial unique index to handle NULL parent_id properly

-- For main categories (parent_id IS NULL): unique on (company_id, name) where parent_id is null
DROP INDEX IF EXISTS idx_categories_unique_main_name;
CREATE UNIQUE INDEX idx_categories_unique_main_name
  ON public.categories (company_id, name)
  WHERE parent_id IS NULL;

-- For subcategories (parent_id IS NOT NULL): unique on (company_id, parent_id, name)
DROP INDEX IF EXISTS idx_categories_unique_sub_name;
CREATE UNIQUE INDEX idx_categories_unique_sub_name
  ON public.categories (company_id, parent_id, name)
  WHERE parent_id IS NOT NULL;

-- Step 4: Add index on slug for faster lookups
DROP INDEX IF EXISTS idx_categories_slug;
CREATE INDEX idx_categories_slug ON public.categories (slug);

-- Note: Slug uniqueness is not enforced at DB level since:
-- 1. Different companies can have categories with same slug
-- 2. UI uses company filtering anyway
-- If globally unique slugs are needed later, add: CREATE UNIQUE INDEX idx_categories_unique_slug ON public.categories (company_id, slug);

