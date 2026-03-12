-- Migration: Update Order Status Workflow
-- New status workflow: Processing -> Awaiting Payment -> Shipped -> Completed & Sent
-- 
-- Database status values mapping:
-- - 'new' = Processing (auto-set when company user creates order)
-- - 'pending' = Awaiting Payment
-- - 'shipped' = Shipped  
-- - 'approved' = Completed & Sent
--
-- This migration updates existing orders to the new status values.

-- Step 1: Map old statuses to new ones
-- 'paid' -> 'approved' (Completed & Sent)
UPDATE quotes SET status = 'approved' WHERE status = 'paid';

-- 'delivered' -> 'approved' (Completed & Sent)
UPDATE quotes SET status = 'approved' WHERE status = 'delivered';

-- 'completed' -> 'approved' (Completed & Sent)
UPDATE quotes SET status = 'approved' WHERE status = 'completed';

-- 'draft' -> 'new' (Processing)
UPDATE quotes SET status = 'new' WHERE status = 'draft';

-- 'processing' -> 'new' (Processing - if it was used as old processing)
-- Note: We keep 'new' for Processing in the new workflow
UPDATE quotes SET status = 'new' WHERE status = 'processing';

-- 'awaiting_payment' -> 'pending' (Awaiting Payment)
UPDATE quotes SET status = 'pending' WHERE status = 'awaiting_payment';

-- 'partially_paid' -> 'pending' (Awaiting Payment)
UPDATE quotes SET status = 'pending' WHERE status = 'partially_paid';

-- 'rejected' -> 'pending' (Awaiting Payment - needs attention)
UPDATE quotes SET status = 'pending' WHERE status = 'rejected';

-- 'expired' -> 'pending' (Awaiting Payment - needs attention)
UPDATE quotes SET status = 'pending' WHERE status = 'expired';

-- 'ready_to_ship' -> 'shipped' (Shipped)
UPDATE quotes SET status = 'shipped' WHERE status = 'ready_to_ship';

-- Step 2: Verify the migration
-- After running this migration, all quotes should have one of these statuses:
-- 'new' (Processing), 'pending' (Awaiting Payment), 'shipped' (Shipped), 'approved' (Completed & Sent)

-- Count orders by status to verify
SELECT status, COUNT(*) as count 
FROM quotes 
GROUP BY status 
ORDER BY status;

-- Note: The 'shipped' status may need to be added if it doesn't exist
-- The quotes table should accept any text value for status, but if there's a CHECK constraint,
-- you may need to update it:
-- ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_status_check;
-- ALTER TABLE quotes ADD CONSTRAINT quotes_status_check 
--   CHECK (status IN ('new', 'pending', 'shipped', 'approved'));

