-- Migration: Add invoice-related fields to companies table
-- These fields are required for generating Bulgarian-compliant proforma invoices
-- 
-- Fields added:
--   - mol: МОЛ (Материално Отговорно Лице) - Legal representative full name
--   - city: City of the company (for invoices)
--   - bank_name: Name of the company's bank
--   - iban: International Bank Account Number
--   - bic: Bank Identifier Code (SWIFT)

-- Add mol column (Legal Representative)
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS mol TEXT;

COMMENT ON COLUMN companies.mol IS 'МОЛ (Материално Отговорно Лице) - Legal representative full name for invoices';

-- Add city column
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS city TEXT;

COMMENT ON COLUMN companies.city IS 'City of the company, used on invoices and proforma invoices';

-- Add bank_name column
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS bank_name TEXT;

COMMENT ON COLUMN companies.bank_name IS 'Name of the company bank for invoice bank details';

-- Add iban column
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS iban TEXT;

COMMENT ON COLUMN companies.iban IS 'International Bank Account Number (IBAN) for payments';

-- Add bic column
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS bic TEXT;

COMMENT ON COLUMN companies.bic IS 'Bank Identifier Code (BIC/SWIFT) for international transfers';

-- Verify the columns were added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'companies' 
  AND column_name IN ('mol', 'city', 'bank_name', 'iban', 'bic')
ORDER BY column_name;

