-- FurniTrade Database Schema
-- Run this in your Supabase SQL editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Companies Table
CREATE TABLE companies (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    logo_url TEXT,
    stripe_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Profiles Table (extends auth.users)
CREATE TABLE profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'sales', 'buyer')) DEFAULT 'buyer',
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Products Table
CREATE TABLE products (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    sku TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL DEFAULT 'Uncategorized',
    moq INTEGER NOT NULL DEFAULT 1,
    retail_price DECIMAL(10, 2) NOT NULL,
    wholesale_price DECIMAL(10, 2) NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    images TEXT[] DEFAULT '{}',
    specs JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(company_id, sku)
);

-- Quotes Table
CREATE TABLE quotes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    customer_id TEXT NOT NULL,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    items JSONB NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL,
    tax DECIMAL(10, 2),
    shipping DECIMAL(10, 2),
    total DECIMAL(10, 2) NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'expired')) DEFAULT 'pending',
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    notes TEXT,
    customer_email TEXT,
    customer_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Orders Table
CREATE TABLE orders (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    customer_id TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_name TEXT,
    items JSONB NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL,
    tax DECIMAL(10, 2),
    shipping DECIMAL(10, 2),
    total DECIMAL(10, 2) NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'processing', 'shipped', 'delivered', 'cancelled')) DEFAULT 'pending',
    payment_id TEXT,
    payment_status TEXT CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
    tracking_number TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    shipped_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes
CREATE INDEX idx_products_company_id ON products(company_id);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_quotes_company_id ON quotes(company_id);
CREATE INDEX idx_quotes_status ON quotes(status);
CREATE INDEX idx_orders_company_id ON orders(company_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_customer_email ON orders(customer_email);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quotes_updated_at BEFORE UPDATE ON quotes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies

-- Enable RLS
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Companies Policies
CREATE POLICY "Users can view their own company"
    ON companies FOR SELECT
    USING (
        id IN (
            SELECT company_id FROM profiles
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own company"
    ON companies FOR UPDATE
    USING (
        id IN (
            SELECT company_id FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Profiles Policies
CREATE POLICY "Users can view profiles in their company"
    ON profiles FOR SELECT
    USING (
        company_id IN (
            SELECT company_id FROM profiles
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own profile"
    ON profiles FOR UPDATE
    USING (id = auth.uid());

-- Products Policies
CREATE POLICY "Anyone can view products"
    ON products FOR SELECT
    USING (true);

CREATE POLICY "Users can insert products in their company"
    ON products FOR INSERT
    WITH CHECK (
        company_id IN (
            SELECT company_id FROM profiles
            WHERE id = auth.uid() AND role IN ('admin', 'sales')
        )
    );

CREATE POLICY "Users can update products in their company"
    ON products FOR UPDATE
    USING (
        company_id IN (
            SELECT company_id FROM profiles
            WHERE id = auth.uid() AND role IN ('admin', 'sales')
        )
    );

CREATE POLICY "Users can delete products in their company"
    ON products FOR DELETE
    USING (
        company_id IN (
            SELECT company_id FROM profiles
            WHERE id = auth.uid() AND role IN ('admin', 'sales')
        )
    );

-- Quotes Policies
CREATE POLICY "Anyone can insert quotes"
    ON quotes FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Users can view quotes for their company"
    ON quotes FOR SELECT
    USING (
        company_id IN (
            SELECT company_id FROM profiles
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Admins can update quotes in their company"
    ON quotes FOR UPDATE
    USING (
        company_id IN (
            SELECT company_id FROM profiles
            WHERE id = auth.uid() AND role IN ('admin', 'sales')
        )
    );

-- Orders Policies
CREATE POLICY "Users can view orders for their company"
    ON orders FOR SELECT
    USING (
        company_id IN (
            SELECT company_id FROM profiles
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Anyone can create orders"
    ON orders FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Admins can update orders in their company"
    ON orders FOR UPDATE
    USING (
        company_id IN (
            SELECT company_id FROM profiles
            WHERE id = auth.uid() AND role IN ('admin', 'sales')
        )
    );

-- Function to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, role)
    VALUES (NEW.id, NEW.email, 'buyer');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

