# Architecture

## System diagram

```text
[Browser: React + Vite SPA]
  - Routes: /auth/*, /dashboard/*
  - State: TanStack Query + Zustand
  - Context: AppContext (currentAccount/currentCompany/workspaceId)
  - i18n: i18next (en/bg)
          |
          | supabase-js (auth, db, storage, realtime)
          v
[Supabase]
  ├─ Auth (auth.users)
  ├─ Postgres tables (profiles, companies, products, categories, quotes, complaints, wishlist_items, ...)
  ├─ Tenant compatibility layer (tenants, tenant_memberships, tenant_domains) in single-tenant mode
  ├─ Storage buckets (complaints, logos, category-images)
  └─ Realtime channels (orders/complaints updates)
          |
          +--> External HTTP integrations:
                - Econt edge functions
                - Resend API helper
                - Stripe publishable-key bootstrap
```

## Runtime architecture

### Routing
- Workspace entry is `/dashboard` only.
- Removed route families:
  - `/platform/*`
  - `/t/:slug/*`

### Auth and workspace resolution
- `TenantProvider` still resolves membership + tenant row for compatibility and RLS alignment.
- `AppContext` provides the app-facing API:
  - `currentAccount`
  - `currentCompany`
  - `workspaceId`
  - `workspaceName`
- Most frontend modules now consume `workspaceId` from `AppContext` while DB filters still use `tenant_id`.

### Data isolation model
- DB remains tenant-column based for safety (`tenant_id` is kept).
- Single-tenant soft cut migration (`20260312123000_single_tenant_soft_cut.sql`) enforces one fixed tenant ID via defaults + triggers.
- This preserves existing integrations (including Econt) without risky table rewrites.

## Core flows

1. Signup/login -> onboarding -> `/dashboard`
2. Product import (CSV/XML) -> category sync -> products upsert
3. Order/quote flow -> status processing -> complaints/wishlist/analytics
4. Econt shipping via edge functions + `tenant_integrations` / `shipments`

## Permissions summary
- App roles in use: `admin`, `company`.
- Membership checks are still enforced for dashboard access.
- Platform-admin console permissions are deprecated in single-tenant mode.

## Operational notes
- Build verified with `npm run build`.
- No automated backend rollback framework; rely on DB backups + migration discipline.
