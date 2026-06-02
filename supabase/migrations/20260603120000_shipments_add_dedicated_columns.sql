begin;

-- ============================================================================
-- Phase 1.5 of the Econt capabilities audit (docs/ECONT_CAPABILITIES_AUDIT.md).
--
-- We add dedicated columns for fields that already exist inside
-- `econt_label_data` and a few audit/error columns. This is a pure storage
-- change — Econt request payloads are NOT touched. The `econt_label_data`
-- raw JSON column is kept as-is so support replays still work.
-- ============================================================================

alter table public.shipments
  add column if not exists service_name          text,
  add column if not exists service_description   text,
  add column if not exists expected_delivery_at  timestamptz,
  add column if not exists pdf_url               text,
  add column if not exists print_url             text,
  add column if not exists error_log             jsonb,
  add column if not exists created_by            uuid references auth.users(id) on delete set null,
  add column if not exists cancelled_at          timestamptz,
  add column if not exists cancel_reason         text;

-- Backfill from the existing JSON blob. We only touch rows that have not
-- already been populated by a fresh write, so this migration is idempotent.
update public.shipments
   set
     service_description = coalesce(
       service_description,
       nullif(econt_label_data->>'service_description', ''),
       nullif(econt_label_data->'raw'->'label'->'services'->0->>'description', '')
     ),
     expected_delivery_at = coalesce(
       expected_delivery_at,
       (nullif(econt_label_data->>'expected_delivery_at', ''))::timestamptz
     ),
     pdf_url = coalesce(
       pdf_url,
       nullif(econt_label_data->>'pdfUrl', ''),
       nullif(econt_label_data->>'pdf_url', ''),
       nullif(econt_label_data->'raw'->>'pdfURL', ''),
       nullif(econt_label_data->'raw'->'label'->>'pdfURL', '')
     ),
     print_url = coalesce(
       print_url,
       nullif(econt_label_data->>'printUrl', ''),
       nullif(econt_label_data->>'print_url', ''),
       nullif(econt_label_data->'raw'->>'printURL', ''),
       nullif(econt_label_data->'raw'->'label'->>'printURL', '')
     )
 where econt_label_data is not null;

-- Useful when listing open shipments per order, and when filtering UI lists.
create index if not exists idx_shipments_tenant_status
  on public.shipments(tenant_id, status);

commit;
