-- Sample Data for FurniTrade
-- Run this after running schema.sql

-- Insert sample company
INSERT INTO companies (id, name, slug, logo_url)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Acme Furniture Co.',
    'acme-furniture',
    'https://via.placeholder.com/200x80?text=Acme+Furniture'
);

-- Insert sample products
INSERT INTO products (company_id, sku, name, description, category, moq, retail_price, wholesale_price, stock, images) VALUES
(
    '00000000-0000-0000-0000-000000000001',
    'CHAIR-001',
    'Modern Dining Chair',
    'Elegant dining chair with comfortable cushioning and solid wood legs. Perfect for contemporary dining spaces.',
    'Chairs',
    10,
    299.99,
    199.99,
    50,
    ARRAY['https://images.unsplash.com/photo-1503602642458-232111445657?w=500']
),
(
    '00000000-0000-0000-0000-000000000001',
    'SOFA-001',
    '3-Seater Fabric Sofa',
    'Luxurious 3-seater sofa with premium fabric upholstery and plush cushions. Ideal for living rooms.',
    'Sofas',
    5,
    1299.99,
    899.99,
    20,
    ARRAY['https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=500']
),
(
    '00000000-0000-0000-0000-000000000001',
    'TABLE-001',
    'Solid Wood Coffee Table',
    'Handcrafted coffee table made from premium solid wood with natural finish.',
    'Tables',
    5,
    499.99,
    349.99,
    30,
    ARRAY['https://images.unsplash.com/photo-1532372320572-cda25653a26d?w=500']
),
(
    '00000000-0000-0000-0000-000000000001',
    'BED-001',
    'King Size Platform Bed',
    'Modern platform bed with storage drawers and upholstered headboard.',
    'Beds',
    3,
    899.99,
    649.99,
    15,
    ARRAY['https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=500']
),
(
    '00000000-0000-0000-0000-000000000001',
    'DESK-001',
    'Executive Office Desk',
    'Professional executive desk with built-in cable management and spacious drawers.',
    'Desks',
    8,
    799.99,
    549.99,
    25,
    ARRAY['https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=500']
),
(
    '00000000-0000-0000-0000-000000000001',
    'CHAIR-002',
    'Ergonomic Office Chair',
    'Premium ergonomic office chair with lumbar support and adjustable features.',
    'Chairs',
    12,
    399.99,
    279.99,
    40,
    ARRAY['https://images.unsplash.com/photo-1505797149-43b7e10d377e?w=500']
),
(
    '00000000-0000-0000-0000-000000000001',
    'SHELF-001',
    'Modular Bookshelf',
    'Versatile modular bookshelf system that can be configured in multiple ways.',
    'Storage',
    15,
    249.99,
    169.99,
    60,
    ARRAY['https://images.unsplash.com/photo-1594620302200-9a762244a156?w=500']
),
(
    '00000000-0000-0000-0000-000000000001',
    'LAMP-001',
    'Modern Floor Lamp',
    'Contemporary floor lamp with adjustable height and dimmable LED light.',
    'Lighting',
    20,
    149.99,
    99.99,
    5,
    ARRAY['https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=500']
);

-- Note: To test the application, you'll need to:
-- 1. Create a user account through the signup flow
-- 2. Complete the onboarding to create your company
-- 3. The products above are for the sample company 'acme-furniture'
-- 4. You can import more products using the CSV import feature

