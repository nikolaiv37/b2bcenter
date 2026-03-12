-- Replace legacy quotes table from schema.sql with app-compatible shape
-- create-quotes-table.sql runs next and recreates this table.
drop table if exists public.quotes cascade;
