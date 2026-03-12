-- Create Complaints & Returns table
-- This page saves hours of WhatsApp chaos every week

CREATE TABLE IF NOT EXISTS complaints (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL,
    order_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'in-review', 'approved', 'rejected')) DEFAULT 'pending',
    items JSONB NOT NULL DEFAULT '[]',
    photos TEXT[] DEFAULT '{}',
    reason TEXT NOT NULL,
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_complaints_user_id ON complaints(user_id);
CREATE INDEX IF NOT EXISTS idx_complaints_order_id ON complaints(order_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_created_at ON complaints(created_at);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_complaints_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS complaints_updated_at_trigger ON complaints;
CREATE TRIGGER complaints_updated_at_trigger
    BEFORE UPDATE ON complaints
    FOR EACH ROW
    EXECUTE FUNCTION update_complaints_updated_at();

-- Row Level Security (RLS)
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own complaints" ON complaints;
DROP POLICY IF EXISTS "Users can insert their own complaints" ON complaints;
DROP POLICY IF EXISTS "Users can update pending complaints" ON complaints;

-- Policy: Users can only see their own complaints (including dev mode)
CREATE POLICY "Users can view their own complaints"
    ON complaints FOR SELECT
    USING (
        (auth.uid() IS NOT NULL AND user_id = auth.uid())
        OR auth.uid() IS NULL
        OR user_id = '00000000-0000-0000-0000-000000000123'::uuid
    );

-- Policy: Users can insert their own complaints (including dev mode)
CREATE POLICY "Users can insert their own complaints"
    ON complaints FOR INSERT
    WITH CHECK (
        (auth.uid() IS NOT NULL AND user_id = auth.uid())
        OR auth.uid() IS NULL
        OR user_id = '00000000-0000-0000-0000-000000000123'::uuid
    );

-- Policy: Users can update their own complaints (only if pending, including dev mode)
CREATE POLICY "Users can update pending complaints"
    ON complaints FOR UPDATE
    USING (
        (
            (auth.uid() IS NOT NULL AND user_id = auth.uid())
            OR auth.uid() IS NULL
            OR user_id = '00000000-0000-0000-0000-000000000123'::uuid
        )
        AND status = 'pending'
    )
    WITH CHECK (
        (
            (auth.uid() IS NOT NULL AND user_id = auth.uid())
            OR auth.uid() IS NULL
            OR user_id = '00000000-0000-0000-0000-000000000123'::uuid
        )
        AND status = 'pending'
    );

-- Create storage bucket for complaint photos (safe to rerun).
INSERT INTO storage.buckets (id, name, public)
VALUES ('complaints', 'complaints', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: Users can upload their own complaint photos
DROP POLICY IF EXISTS "Users can upload complaint photos" ON storage.objects;
CREATE POLICY "Users can upload complaint photos"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'complaints' AND
         auth.uid()::text = (storage.foldername(name))[1]
   );

-- Storage policy: Users can view their own complaint photos
DROP POLICY IF EXISTS "Users can view complaint photos" ON storage.objects;
 CREATE POLICY "Users can view complaint photos"
     ON storage.objects FOR SELECT
     USING (
        bucket_id = 'complaints' AND
         auth.uid()::text = (storage.foldername(name))[1]
    );
