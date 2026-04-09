-- Add quote-level visibility for backorder / request lines
ALTER TABLE quotes
ADD COLUMN IF NOT EXISTS has_backorder_items BOOLEAN DEFAULT FALSE;

UPDATE quotes
SET has_backorder_items = FALSE
WHERE has_backorder_items IS NULL;

CREATE INDEX IF NOT EXISTS idx_quotes_tenant_backorder_items
ON quotes(tenant_id, has_backorder_items);
