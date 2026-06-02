begin;

-- ============================================================================
-- Product shipping data
--
-- Adds nullable shipping fields to `products` so admins can store carrier-
-- agnostic packaging info per SKU. The Econt shipment form uses these to
-- auto-fill weight, parcel count and (later) dimensions for an order.
--
-- All fields are nullable so existing rows remain valid. The Econt edge
-- function does not consume dimensions yet — they are stored only.
-- ============================================================================

alter table public.products
  add column if not exists shipping_weight_kg     numeric,
  add column if not exists shipping_parcels_count integer not null default 1,
  add column if not exists shipping_length_cm     numeric,
  add column if not exists shipping_width_cm      numeric,
  add column if not exists shipping_height_cm     numeric,
  add column if not exists shipping_requires_review boolean not null default false;

commit;
