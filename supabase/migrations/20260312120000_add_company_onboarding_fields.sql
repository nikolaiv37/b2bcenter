-- Migration: Create companies table (if needed) and add onboarding fields
-- Run this in your Supabase SQL editor
-- This migration is safe to run multiple times (idempotent)

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create companies table if it doesn't exist
CREATE TABLE IF NOT EXISTS companies (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    logo_url TEXT,
    stripe_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add new onboarding fields to companies table (if they don't exist)
DO $$ 
BEGIN
    -- Add eik_bulstat column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'companies' AND column_name = 'eik_bulstat'
    ) THEN
        ALTER TABLE companies ADD COLUMN eik_bulstat TEXT;
    END IF;

    -- Add vat_number column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'companies' AND column_name = 'vat_number'
    ) THEN
        ALTER TABLE companies ADD COLUMN vat_number TEXT;
    END IF;

    -- Add phone column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'companies' AND column_name = 'phone'
    ) THEN
        ALTER TABLE companies ADD COLUMN phone TEXT;
    END IF;

    -- Add address column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'companies' AND column_name = 'address'
    ) THEN
        ALTER TABLE companies ADD COLUMN address TEXT;
    END IF;

    -- Add website column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'companies' AND column_name = 'website'
    ) THEN
        ALTER TABLE companies ADD COLUMN website TEXT;
    END IF;

    -- Add onboarding_completed column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'companies' AND column_name = 'onboarding_completed'
    ) THEN
        ALTER TABLE companies ADD COLUMN onboarding_completed BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Update existing companies to mark onboarding as completed
-- (assuming existing companies have already completed onboarding)
UPDATE companies
SET onboarding_completed = TRUE
WHERE onboarding_completed IS NULL OR onboarding_completed = FALSE;

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for companies.updated_at if it doesn't exist
DROP TRIGGER IF EXISTS update_companies_updated_at ON companies;
CREATE TRIGGER update_companies_updated_at 
    BEFORE UPDATE ON companies
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS on companies table if not already enabled
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- Add company_id column to profiles table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'company_id'
    ) THEN
        -- Add company_id column (nullable, will be set during onboarding)
        ALTER TABLE profiles ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
        
        -- Create index for better performance
        CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON profiles(company_id);
    END IF;
END $$;

-- Create RLS policies for companies if they don't exist
DO $$
BEGIN
    -- Policy: Users can view their own company
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'companies' AND policyname = 'Users can view their own company'
    ) THEN
        CREATE POLICY "Users can view their own company"
            ON companies FOR SELECT
            USING (
                id IN (
                    SELECT company_id FROM profiles
                    WHERE id = auth.uid() AND company_id IS NOT NULL
                )
            );
    END IF;

    -- Policy: Users can update their own company
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'companies' AND policyname = 'Users can update their own company'
    ) THEN
        CREATE POLICY "Users can update their own company"
            ON companies FOR UPDATE
            USING (
                id IN (
                    SELECT company_id FROM profiles
                    WHERE id = auth.uid() AND role = 'admin' AND company_id IS NOT NULL
                )
            );
    END IF;

    -- Policy: Allow users to insert their own company (for onboarding)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'companies' AND policyname = 'Users can insert their own company'
    ) THEN
        CREATE POLICY "Users can insert their own company"
            ON companies FOR INSERT
            WITH CHECK (true); -- Allow insert, profile will be updated separately
    END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN companies.eik_bulstat IS 'Bulgarian company registration number (ЕИК / BULSTAT)';
COMMENT ON COLUMN companies.vat_number IS 'VAT Number (ДДС №)';
COMMENT ON COLUMN companies.phone IS 'Company phone number';
COMMENT ON COLUMN companies.address IS 'Full company address';
COMMENT ON COLUMN companies.website IS 'Company website URL (optional)';
COMMENT ON COLUMN companies.onboarding_completed IS 'Whether the company has completed the onboarding process';
