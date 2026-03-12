-- Migration: Add Shipping Method Column to Orders
-- Replaces deposit tracking with shipping method selection
--
-- Shipping Method Options:
-- - 'warehouse_pickup': Pick up from our Warehouse
-- - 'transport_company': Delivery to a transportation company of your choice
-- - 'dropshipping': Delivery to your Customer (Dropshipping)
-- - 'shop_delivery': Delivery to your Shop (DEFAULT)

-- Step 1: Add shipping_method column to quotes table
ALTER TABLE quotes 
ADD COLUMN IF NOT EXISTS shipping_method TEXT DEFAULT 'shop_delivery';

-- Step 2: Update existing orders to have default shipping method
UPDATE quotes 
SET shipping_method = 'shop_delivery' 
WHERE shipping_method IS NULL;

-- Step 3: Make shipping_method NOT NULL after setting defaults
-- (Comment out if your Postgres version doesn't support this syntax)
-- ALTER TABLE quotes ALTER COLUMN shipping_method SET NOT NULL;

-- Step 4: Add check constraint for valid shipping methods
-- ALTER TABLE quotes 
-- ADD CONSTRAINT quotes_shipping_method_check 
-- CHECK (shipping_method IN ('warehouse_pickup', 'transport_company', 'dropshipping', 'shop_delivery'));

-- Step 5: (Optional) Remove deposit-related columns if they exist
-- Uncomment these if you want to remove deposit columns:
-- ALTER TABLE quotes DROP COLUMN IF EXISTS deposit_amount;
-- ALTER TABLE quotes DROP COLUMN IF EXISTS deposit_paid;

-- Verify the migration
SELECT 
  shipping_method, 
  COUNT(*) as count 
FROM quotes 
GROUP BY shipping_method 
ORDER BY shipping_method;

