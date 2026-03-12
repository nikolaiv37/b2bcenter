# Imports Feature (CSV current + XML planned/in-progress)

## Scope snapshot
- Current production path is admin import at `/dashboard/csv-import` rendering `UniversalImportWizard`.
- CSV is implemented end-to-end.
- XML has implemented parser/mapping/validation pipeline, but persistence + operational hardening are partial.

## Current CSV import

### UI steps (current behavior)
1. Open `/dashboard/csv-import`.
2. Step 1 Upload: choose CSV file (`FormatSelectorStep` / legacy `UploadStep`).
3. Step 2 Column mapping: auto-map + manual override (`ColumnMappingStep`, data from `useSmartMapping`).
4. Step 3 Category mapping: map source categories/subcategories to target categories (`CategoryMappingStep`).
5. Step 4 Validation: preview issues and import progress (`ValidationStep`).
6. Step 5 Results: summary and errors (`ImportResultsStep`).

Main files:
- `src/components/import/UniversalImportWizard.tsx`
- `src/hooks/useUniversalImport.ts`
- `src/hooks/useSmartMapping.ts`
- `src/lib/csv/parser.ts`
- `src/lib/csv/distributors.ts`

### Backend/data flow (CSV)
1. Parse CSV (`parseCSVFlexible`) with delimiter auto-detection and normalized headers.
2. Distributor detection + auto-map (`detectDistributor`, `autoMapColumns`).
3. Transform mapped rows (`useSmartMapping.getTransformedData`).
4. Clean/normalize payload in wizard mutation.
5. Category sync + `category_id` assignment (`prepareProductsWithCategoryId` from `src/lib/category-sync-from-import.ts`).
6. Upsert products in batches (`supabase.from('products').upsert(..., { onConflict: 'sku' })`).
7. Invalidate product/category query caches.

### DB tables involved
- `products`
- `categories`
- `import_configs` (not used by CSV flow currently)
- Legacy/infra-only CSV tables (not wired in app path):
  - `csv_distributor_mappings`
  - `category_synonyms`
  - `csv_import_history`

### Validation rules (effective)
- Required mapped fields: `sku`, `name` (and in XML path also `weboffer_price` required by mapping validation).
- Duplicate SKU detection in validation stage.
- Duplicate SKU dedupe before upsert: last row wins.
- Numeric parsing supports decimal comma.
- `weboffer_price` fallback chain: mapped wholesale -> retail -> `0`.
- Images accepted only if URL starts with `http://` or `https://`.

## Mapping UI and mapping storage

### How mapping is represented
- Column mappings: `ColumnMapping[]` (`sourceColumn` -> `targetField`) in `useSmartMapping` state.
- Category mappings: `CategoryMapping[]` (`sourceCategory` -> `targetCategory`, includes `fieldType` category/subcategory).

### How mapping is applied
- `getTransformedData()` builds lookup maps from UI state.
- Category mapping is applied while transforming category values.
- Subcategory can be merged into category text as `Main > Sub`.

### Storage status
- **CSV mapping persistence in app:** not implemented (state-only during current session).
- **XML config persistence hooks exist:** `useXmlMapping.saveConfiguration/loadConfiguration` writes/reads `import_configs`.
- **UI for save/load configs:** currently not exposed in wizard flow.

## Edge cases handled
- Different delimiter styles (`;` vs `,`).
- Header normalization (`trim`, lowercase, spaces -> `_`).
- Field mismatch parse warnings ignored when harmless.
- Missing required row fields are filtered out.
- Large imports use batching (`1000` rows/batch).
- Batch conflict fallback retries one-by-one.
- Category sync is non-destructive (does not delete existing categories).

## Known bugs / gaps
- `products` upsert conflict key is global `sku`; no explicit company scoping in conflict target.
- CSV mapping persistence tables exist but are not used in current import UI.
- XML URL import may fail due to browser CORS/network restrictions (client-side fetch).
- `category-images` storage bucket is referenced in app, but migration file for bucket creation is not present.
- Status/role/table SQL history is fragmented across many migrations; environments can drift.
- `src/lib/xml/parser.ts` ends with `export type { Builder }` without local `Builder` import (potential TS build issue depending on toolchain/settings).

## Planned XML import (assumptions + required work)

### Current assumption from code
- XML feed contains a detectable product array path.
- Fields can be flattened into XPath-like keys and mapped to standard product fields.

### Required work items to make XML flow production-ready
1. Add explicit save/load mapping config UI backed by `import_configs`.
2. Add preflight URL fetch/CORS diagnostics and user guidance.
3. Add import history logging (either reuse `csv_import_history` with format flag or add `import_history`).
4. Harden parser path detection for more feed variants and very deep trees.
5. Add integration tests for common XML provider patterns.
6. Decide and enforce tenant-safe uniqueness strategy for SKU conflicts.

### XML schema strategy
- Keep **schema-flexible ingest**:
  - parse arbitrary XML -> flatten -> user mapping -> normalized product payload.
- Persist mapping configs by company + name + format in `import_configs`.
- Maintain required target fields for valid import: `sku`, `name`, `weboffer_price`.

## Example payloads (synthetic)

### Minimal CSV row
```csv
sku,name,weboffer_price,category,quantity
SKU-001,Sample Chair,99.90,Chairs,10
```

### Minimal XML example
```xml
<?xml version="1.0" encoding="UTF-8"?>
<catalog>
  <products>
    <product>
      <sku>SKU-001</sku>
      <name>Sample Chair</name>
      <prices>
        <wholesale>99.90</wholesale>
      </prices>
      <category>Chairs</category>
      <quantity>10</quantity>
    </product>
  </products>
</catalog>
```
