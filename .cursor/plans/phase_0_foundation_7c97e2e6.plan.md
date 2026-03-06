---
name: Phase 0 Foundation
overview: Scaffold the Next.js app, wire up Supabase (auth, database, clients), build the MUI dark theme, implement Google OAuth with RBAC, and assemble the app shell — everything needed before feature work begins.
todos:
  - id: scaffold
    content: 0.1 -- Scaffold Next.js App Router project with TypeScript, install all dependencies (MUI, MUI X Data Grid Pro, Framer Motion, Supabase SSR, Zod), set up project directory structure
    status: completed
  - id: supabase-clients
    content: 0.2 -- Create Supabase client utilities (server + browser), .env.local template, Next.js middleware for session refresh and auth redirects
    status: completed
  - id: migration
    content: "0.3-0.5 -- Write full database migration SQL: extensions, 9 enums, 24 tables (17 MVP + 7 future), all indexes/constraints, 4 functions/triggers, RLS policies for every table"
    status: completed
  - id: theme
    content: "0.6 -- Build MUI dark theme: palette.ts with concrete hex values, theme.ts with createTheme + component overrides, ThemeRegistry provider for SSR"
    status: completed
  - id: auth
    content: "0.7 -- Implement Google OAuth: login page, auth callback route, middleware auth redirects, profile auto-creation via DB trigger"
    status: completed
  - id: rbac
    content: "0.8 -- Build RBAC utilities: role hierarchy, permission map, hasPermission/hasMinRole helpers, AuthProvider context with useAuth hook"
    status: completed
  - id: shell
    content: "0.9 -- Build app shell: root layout with providers, dashboard layout with sidebar + topbar, placeholder navigation, user menu with sign-out"
    status: completed
  - id: animations
    content: "0.10 -- Set up Framer Motion: shared variant definitions (page, modal, stagger, pulse, toast, expand), PageTransition wrapper component"
    status: completed
  - id: verify
    content: "Final verification: npm run build passes with zero errors/warnings, full auth flow works end-to-end, all DB objects exist"
    status: completed
isProject: false
---

# Phase 0 — Foundation

## Prerequisites

- Supabase project exists (user will provide `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)
- MUI X Data Grid Pro license (user has or will obtain)
- Node.js 18+ installed

---

## 0.1 — Scaffold Next.js + Install Dependencies

Run `create-next-app` with App Router, TypeScript, ESLint, Tailwind disabled (MUI handles styling), `src/` directory enabled.

**Dependencies to install:**

- Core UI: `@mui/material`, `@mui/icons-material`, `@emotion/react`, `@emotion/styled`
- Data Grid: `@mui/x-data-grid-pro`, `@mui/x-license`
- Animation: `framer-motion`
- Supabase: `@supabase/supabase-js`, `@supabase/ssr`
- Validation: `zod`

**Project structure:**

```
src/
  app/
    (auth)/
      login/page.tsx              -- Google OAuth sign-in page
    (dashboard)/
      layout.tsx                  -- Authenticated layout (sidebar + topbar)
      page.tsx                    -- Dashboard landing (redirects to projects later)
    auth/
      callback/route.ts           -- OAuth callback handler
    api/                          -- API routes (empty until Phase 1+)
    layout.tsx                    -- Root layout (ThemeProvider, CssBaseline)
    page.tsx                      -- Root redirect (to login or dashboard)
  components/
    layout/
      Sidebar.tsx
      TopBar.tsx
    providers/
      ThemeRegistry.tsx           -- MUI + Emotion cache for App Router SSR
      AuthProvider.tsx            -- Client-side auth context (user + role)
    animations/
      PageTransition.tsx          -- Framer Motion page wrapper
  lib/
    supabase/
      client.ts                   -- createBrowserClient
      server.ts                   -- createServerClient (for Server Components + API routes)
    auth/
      rbac.ts                     -- hasPermission(), role hierarchy, permission map
    animations/
      variants.ts                 -- Shared Framer Motion variant objects
  theme/
    theme.ts                      -- createTheme() with full palette + overrides
    palette.ts                    -- Color constants (hex values)
  types/
    database.ts                   -- TypeScript types matching Supabase schema
  middleware.ts                   -- Next.js middleware (auth redirect)
```

---

## 0.2 — Supabase Client Setup

Create `.env.local` template:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

`**src/lib/supabase/server.ts**` — uses `createServerClient` from `@supabase/ssr` with cookie handling for Server Components and API routes.

`**src/lib/supabase/client.ts**` — uses `createBrowserClient` from `@supabase/ssr` for Client Components.

`**src/middleware.ts**` — Next.js middleware that:

- Creates a Supabase server client on every request
- Refreshes the session (handles token rotation)
- Redirects unauthenticated users to `/login` (except `/login` and `/auth/callback`)
- Redirects authenticated users away from `/login` to `/`

---

## 0.3 — Database Migration SQL

Single migration file: `supabase/migrations/00001_initial_schema.sql`

This file will be run against the existing Supabase project. It creates everything from [schema.md](docs/schema.md) in dependency order:

1. **Extensions:** `pgcrypto` (for `gen_random_uuid()`), `pg_trgm` (for trigram autocomplete index on `test_steps.description`)
2. **Enums (9):** `user_role`, `test_case_type`, `automation_status`, `execution_status`, `platform`, `invitation_status`, `test_run_status`, `webhook_event_status`, `import_status`
3. **MVP tables (17):** `profiles`, `invitations`, `projects`, `suites`, `test_cases`, `test_steps`, `test_runs`, `test_run_cases`, `execution_results`, `annotations`, `attachments`, `test_case_versions`, `bug_links`, `csv_imports`, `csv_import_errors`, `webhook_events`, `grid_column_preferences`
4. **Future placeholder tables (7):** `integrations`, `comments`, `activity_log`, `notifications`, `custom_field_definitions`, `custom_field_values`, `test_case_dependencies`
5. **All indexes** as specified in schema.md
6. **All constraints** (UNIQUE, CHECK, FK with CASCADE/SET NULL)

---

## 0.4 — Database Functions and Triggers

Included in the same migration file:

- `**update_updated_at()`** — trigger function setting `updated_at = now()` on UPDATE. Applied to all tables with `updated_at`.
- `**create_profile_on_signup()`** — trigger on `auth.users` INSERT that creates a `profiles` row from OAuth metadata (email, full_name, avatar_url). Default role: `viewer`.
- `**generate_test_case_id(suite_id)`** — atomically reads `suites.next_sequence`, constructs `display_id = prefix || '-' || next_sequence`, increments `next_sequence`. Uses `SELECT ... FOR UPDATE` row lock.
- `**snapshot_test_case_version()`** — trigger on `test_cases` UPDATE that captures current state + steps as JSONB into `test_case_versions`.

---

## 0.5 — RLS Policies

Included in the migration file. Enable RLS on all tables. Policies follow the matrix from schema.md:

- **SELECT:** All authenticated users on all data tables; Admin-only on `invitations`; Admin+SDET on `webhook_events`
- **INSERT/UPDATE:** Admin, QA Engineer, SDET on data tables; Admin-only on `invitations`; Service role only on `webhook_events`
- **DELETE:** Admin-only on most tables; Admin or owner on `attachments`
- **Viewer:** SELECT only everywhere — no write policies match `viewer` role

Each policy queries `profiles.role` via `auth.uid()` to determine access.

---

## 0.6 — MUI Dark Theme

`**src/theme/palette.ts`** — concrete hex values for the design system:

```
Background:    #0A0A0F (default), #111118 (paper/surface-1), #1A1A24 (surface-2), #222230 (surface-3)
Primary:       #6366F1 (electric indigo)
Success:       #14B8A6 (vivid teal)
Error:         #F43F5E (warm rose)
Warning:       #F59E0B (amber)
Info:          #A78BFA (soft violet)
Neutral:       #64748B (cool slate)
Text primary:  #E8E8ED
Text secondary:#8888A0
```

These sit in the ~70-85% saturation band per the design system, meet WCAG AA on the dark background, and feel cohesive together.

`**src/theme/theme.ts**` — `createTheme()` with:

- `palette.mode: 'dark'`
- Custom palette entries for all 6 accent roles
- Component overrides: no shadows (1px borders instead), rounded corners (8px cards, 4px inputs), button hover glows, Data Grid row hover/selection, toast styling
- Typography: clean sans-serif (Inter or Roboto)

`**src/components/providers/ThemeRegistry.tsx**` — Emotion cache + ThemeProvider setup for App Router SSR (prevents FOUC).

---

## 0.7 — Google OAuth Flow

**Supabase Dashboard config** (manual step): Enable Google OAuth provider with company Google Workspace credentials, set redirect URL to `{app_url}/auth/callback`.

`**src/app/(auth)/login/page.tsx`** — Sign-in page with a single "Sign in with Google" button. Dark themed, centered, app logo/title. Calls `supabase.auth.signInWithOAuth({ provider: 'google' })` with redirect to `/auth/callback`.

`**src/app/auth/callback/route.ts`** — exchanges the OAuth code for a session using `supabase.auth.exchangeCodeForSession(code)`, then redirects to `/`.

`**src/middleware.ts`** — (already described in 0.2) handles session refresh and auth-based redirects on every request.

The `create_profile_on_signup()` trigger (from 0.4) auto-creates the `profiles` row on first sign-in.

---

## 0.8 — RBAC Utilities

`**src/lib/auth/rbac.ts`:**

- Role hierarchy constant: `admin > sdet > qa_engineer > viewer`
- Permission map defining which roles can perform which actions (e.g., `write` requires admin/sdet/qa_engineer, `manage_users` requires admin, `view_webhooks` requires admin/sdet)
- `hasPermission(role, action)` — server-side check
- `hasMinRole(role, minRole)` — hierarchy-based check (e.g., "at least qa_engineer")
- `getProfile(supabase)` — helper that calls `supabase.auth.getUser()` then fetches `profiles.role`

`**src/components/providers/AuthProvider.tsx`:**

- Client-side React context providing `{ user, profile, role, isLoading }`
- Uses `supabase.auth.onAuthStateChange` to stay reactive
- Fetches profile on mount and auth change
- Exposes `useAuth()` hook for any component to check the current user's role

---

## 0.9 — App Shell

`**src/app/layout.tsx`** (root):

- Wraps children in `ThemeRegistry` and `AuthProvider`
- Sets `<html>` to dark color scheme, base font

`**src/app/(dashboard)/layout.tsx`** (authenticated):

- Flex layout: fixed sidebar (left) + scrollable main area
- Passes `children` through `PageTransition` wrapper
- Only renders for authenticated users (middleware handles redirect)

`**src/components/layout/Sidebar.tsx`:**

- App logo/title at top
- Navigation section with placeholder items (Projects, Test Runs, Reports — disabled until Phase 1+)
- Active indicator that slides to selected item (200ms ease-out, per animation spec)
- User avatar + role badge at bottom
- Collapse/expand toggle

`**src/components/layout/TopBar.tsx`:**

- Breadcrumb placeholder (context-dependent, wired in Phase 1+)
- Project switcher placeholder (dropdown, wired in Phase 1)
- User menu: avatar, name, role badge, sign-out button

---

## 0.10 — Framer Motion Base

`**src/lib/animations/variants.ts`:**

- `pageTransition` — fade + slide up 8px, 300ms ease-out
- `modalEntrance` — scale 95% to 100% + fade, 250ms
- `staggerContainer` / `staggerChild` — for lists, 50ms stagger
- `statusPulse` — scale [1, 1.15, 1], 200ms
- `slideIn` — for toasts, 300ms in / 200ms out
- `expandCollapse` — height auto + fade, 250ms

`**src/components/animations/PageTransition.tsx`:**

- Wraps page content with `motion.div` using `pageTransition` variants
- Used in the dashboard layout to animate between pages

---

## Verification

After all tasks complete:

- `npm run build` passes with zero errors and zero warnings
- App loads at `localhost:3000`, redirects to `/login`
- Google sign-in completes, profile row visible in Supabase `profiles` table
- Authenticated user sees the app shell (sidebar + topbar), empty dashboard content
- Unauthenticated request to `/` redirects to `/login`
- Database has all 24 tables, 9 enums, 4 functions, RLS on every table

