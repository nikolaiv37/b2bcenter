-- Add order_number column to quotes table
-- This will auto-generate order numbers starting from 1001

-- Add order_number column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quotes' AND column_name = 'order_number'
  ) THEN
    ALTER TABLE quotes ADD COLUMN order_number INTEGER;
  END IF;
END $$;

-- Create sequence for order numbers starting at 1001
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1001;

-- Set default value for order_number using the sequence
ALTER TABLE quotes 
  ALTER COLUMN order_number 
  SET DEFAULT nextval('order_number_seq');

-- Update existing rows to have order numbers
-- This will assign numbers starting from 1001 to existing orders
DO $$
DECLARE
  rec RECORD;
  order_num INTEGER := 1000;
BEGIN
  FOR rec IN SELECT id FROM quotes WHERE order_number IS NULL ORDER BY created_at ASC
  LOOP
    order_num := order_num + 1;
    UPDATE quotes SET order_number = order_num WHERE id = rec.id;
  END LOOP;
  
  -- Update sequence to continue from the highest order number
  IF order_num >= 1001 THEN
    PERFORM setval('order_number_seq', order_num);
  END IF;
END $$;

-- Add unique constraint on order_number
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'quotes_order_number_key'
  ) THEN
    ALTER TABLE quotes ADD CONSTRAINT quotes_order_number_key UNIQUE (order_number);
  END IF;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_quotes_order_number ON quotes(order_number);

