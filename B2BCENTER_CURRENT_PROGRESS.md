# B2BCENTER CURRENT PROGRESS

> Snapshot: 2026-05-19 | Last commit: `333c1c9` — "Add order templates and backorder requests"

---

## Repo State

| Property | Value |
|---|---|
| **Branch** | (current HEAD) |
| **Last commit** | `333c1c9` — Add order templates and backorder requests |
| **Commits behind** | Unknown (no remote check performed) |
| **Build status** | Last verified via `npm run build` per docs |
| **Working tree** | Contains `.env` with real Supabase credentials (should not be committed) |

### Recent commit history (last 20)
```
333c1c9 Add order templates and backorder requests
9b0316d translation added
3a2c384 fixes bugs etc
9ae02c1 fixing bugs, errors, econt
d67e4e8 Merge commit 'a53211b'
a53211b redesign
ff1b67a redesign admin dashboard overview
eef808d changes orders
89422b9 Improve client invite flow: admin fills details, client sets password only
5dabb2a implement account manage profile, mobile fixes
f6f5275 csv import fix, import catalog, improve UI out-of-stock
3e778f4 Improve mobile dashboard navigation and responsive page layouts
69fc63c Fix variable scoping in single-tenant soft-cut migration
0dc3911 Fix single-tenant soft-cut migration array syntax
c682383 Refresh runbook and migration docs for single-tenant b2bcenter
68618ba Add single-tenant DB soft cut and formalize Econt migration
0053543 Cut multitenant frontend surface to single-workspace mode
7efaa94 Simplify single-tenant navigation and membership resolution
6f0a633 Enable single-tenant host fallback for standalone app
```

---

## Last Completed Work

The most recent completed work (commit `333c1c9`) added:

1. **Order templates** — new `order_templates` table (migration `20260409113000`), UI at `/dashboard/order-templates`, per-user saved order templates with RLS policies
2. **Backorder flag** — `has_backorder_items` column on `quotes` table (migration `20260409143000`), type updates in `QuoteItem` and `Quote` interfaces

Prior work includes:
- Full i18n translation layer (EN/BG)
- Admin dashboard overview redesign
- Econt integration fixes
- Client invite flow improvements
- Mobile responsive improvements
- CSV import fixes
- Single-tenant migration and cut

---

## Known Issues

### High Priority
| Issue | Impact | Location |
|---|---|---|
| `.env` contains real Supabase credentials | Security risk | Root `.env` |
| No down-migration framework | Cannot rollback DB changes safely | `supabase/migrations/` |
| `products` upsert conflict on global `sku` | Data integrity risk in multi-company scenarios | Import wizard upsert |

### Medium Priority
| Issue | Impact | Location |
|---|---|---|
| XML import persistence not wired | Feature incomplete | `src/lib/xml/`, `src/hooks/useXmlMapping.ts` |
| `src/lib/xml/parser.ts` has dangling `export type { Builder }` | Potential TS build issue | Parser file |
| `category-images` bucket migration may be missing | Runtime error on category image upload | Supabase migrations |
| Stripe/Resend clients exist but no backend | Non-functional features | `src/lib/stripeClient.ts`, `src/lib/resendClient.ts` |
| CSV mapping persistence tables unused | Dead code / unused schema | `csv_distributor_mappings`, `category_synonyms` |

### Low Priority
| Issue | Impact | Location |
|---|---|---|
| Legacy `schema.sql` outdated | Confusion for new devs | `supabase/schema.sql` |
| Platform admin DB flags remain | Dead schema | Various migrations |
| `orders` table in legacy schema unused | Confusion | `supabase/schema.sql` |
| Commit messages vague ("fixes bugs etc") | Hard to track changes | Git history |

---

## Safest Next Coding Step

**Recommended: Wire XML import configuration persistence**

This is the most logical next step because:
1. The parser and mapping infrastructure already exists
2. The `import_configs` table is already created
3. `useXmlMapping` has `saveConfiguration`/`loadConfiguration` methods
4. It's a contained feature that doesn't touch auth, billing, or core order flow

**What to do:**
1. Add save/load config UI to `UniversalImportWizard`
2. Connect `useXmlMapping.saveConfiguration` / `loadConfiguration` to the UI
3. Add import history logging to `csv_import_history` (add a `format` column: `'csv'` | `'xml'`)
4. Test with a sample XML feed

**Alternative safe steps:**
- Add import history UI to show past imports
- Fix `products` upsert to use `(tenant_id, sku)` conflict target
- Add `category-images` bucket creation migration if missing

---

## Warnings — Do NOT Change Yet

| Area | Reason |
|---|---|
| **`useAuth.ts`** | Complex auth bootstrap with race-condition guards, tenant mismatch handling, and silent refresh. Any change risks breaking login for all users. |
| **`TenantProvider.tsx`** | Handles session resolution, membership lookup with retry, timeout handling, and query cache invalidation. Tightly coupled to auth flow. |
| **`MembershipGuard` / `TenantActiveGuard` / `SignupGuard`** | Gate all dashboard access. Changes could lock users out. |
| **`20260312123000_single_tenant_soft_cut.sql`** | Enforces single-tenant DB behavior. Any change risks data isolation. |
| **`enforce_single_tenant_fk()` trigger** | Blocks foreign tenant_id writes. Removing it without a replacement breaks data isolation. |
| **`current_tenant_id()` function** | Used by RLS policies across all tables. Changes affect all DB access. |
| **`orders` table** | Exists in legacy schema but app uses `quotes` for orders. Do not delete or modify without full audit. |
| **Platform admin policies** | Already dropped by migration 23000. Do not re-add unless re-enabling multi-tenant. |
| **Real Supabase credentials in `.env`** | The actual URL and anon key are live. Do not commit to git. |

---

## Quick Start Commands

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Type-check + build
npm run build

# Lint
npm run lint

# Preview production build
npm run preview
```

## Supabase Bootstrap

Run migrations in order from `supabase/migrations/` (see `FINAL_B2BCENTER_MIGRATION_ORDER.md`).

**Critical:** Before running migration `20260312122700_first_tenant_bootstrap_auto.sql`, ensure at least one `auth.users` row exists.
