-- Create quotes table for quote requests
-- This table stores quote requests from logged-in suppliers

CREATE TABLE IF NOT EXISTS quotes (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    company_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    notes TEXT,
    items JSONB NOT NULL,
    total DECIMAL(10, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'pending', 'approved', 'rejected', 'expired')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_quotes_user_id ON quotes(user_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_created_at ON quotes(created_at);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_quotes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS quotes_updated_at_trigger ON quotes;
CREATE TRIGGER quotes_updated_at_trigger
    BEFORE UPDATE ON quotes
    FOR EACH ROW
    EXECUTE FUNCTION update_quotes_updated_at();

-- Row Level Security (RLS)
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own quotes" ON quotes;
DROP POLICY IF EXISTS "Users can insert their own quotes" ON quotes;
DROP POLICY IF EXISTS "Users can update their own quotes" ON quotes;
DROP POLICY IF EXISTS "Admins can view all quotes" ON quotes;

-- Users can view their own quotes
-- Allows viewing when user_id matches auth.uid() OR when auth.uid() is NULL (dev mode)
CREATE POLICY "Users can view their own quotes"
    ON quotes FOR SELECT
    USING (
        (auth.uid()::text IS NOT NULL AND user_id = auth.uid()::text)
        OR auth.uid()::text IS NULL
    );

-- Users can insert their own quotes
-- Allows inserts when user_id matches auth.uid() OR when auth.uid() is NULL (dev mode)
CREATE POLICY "Users can insert their own quotes"
    ON quotes FOR INSERT
    WITH CHECK (
        (auth.uid()::text IS NOT NULL AND user_id = auth.uid()::text)
        OR auth.uid()::text IS NULL
    );

-- Users can update their own quotes
CREATE POLICY "Users can update their own quotes"
    ON quotes FOR UPDATE
    USING (
        (auth.uid()::text IS NOT NULL AND user_id = auth.uid()::text)
        OR auth.uid()::text IS NULL
    )
    WITH CHECK (
        (auth.uid()::text IS NOT NULL AND user_id = auth.uid()::text)
        OR auth.uid()::text IS NULL
    );

-- Grant permissions
GRANT ALL ON quotes TO authenticated;
GRANT INSERT, SELECT ON quotes TO anon;

