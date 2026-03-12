-- Cleanup script: Remove orphaned companies (companies with no linked profiles)
-- Run this in your Supabase SQL editor to clean up duplicate/orphaned companies

-- First, see which companies are orphaned (no profiles reference them)
SELECT 
    c.id,
    c.name,
    c.slug,
    c.created_at,
    COUNT(p.id) as linked_profiles
FROM companies c
LEFT JOIN profiles p ON p.company_id = c.id
GROUP BY c.id, c.name, c.slug, c.created_at
HAVING COUNT(p.id) = 0
ORDER BY c.created_at DESC;

-- If you want to delete orphaned companies, uncomment the following:
-- WARNING: This will permanently delete companies that have no linked profiles
-- Make sure you review the list above first!

/*
DELETE FROM companies
WHERE id NOT IN (
    SELECT DISTINCT company_id 
    FROM profiles 
    WHERE company_id IS NOT NULL
);
*/

-- To see companies with multiple profiles (shouldn't happen, but good to check):
SELECT 
    c.id,
    c.name,
    COUNT(p.id) as profile_count
FROM companies c
LEFT JOIN profiles p ON p.company_id = c.id
GROUP BY c.id, c.name
HAVING COUNT(p.id) > 1
ORDER BY profile_count DESC;

-- To see the relationship between profiles and companies:
SELECT 
    p.id as profile_id,
    p.email,
    p.role,
    p.company_id,
    c.name as company_name,
    c.slug as company_slug
FROM profiles p
LEFT JOIN companies c ON c.id = p.company_id
ORDER BY p.created_at DESC;

