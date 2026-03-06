# TCM — Test Case Management

[![Vercel Deploy](https://deploy-badge.vercel.app/vercel/tcm-ochre?style=flat)](https://tcm-ochre.vercel.app)

Internal test case management tool replacing Google Sheets test plans. Built for ~20-25 users across 4 roles, managing 10+ projects/year with thousands of test cases per project.

## Tech Stack

- **Frontend:** Next.js 16 (App Router), React 19, TypeScript
- **UI:** MUI 7 + MUI X Data Grid Pro, dark mode only
- **Animation:** Framer Motion
- **Backend/DB/Auth/Storage:** Supabase (Postgres, Auth, Storage, Realtime)
- **Auth:** Google OAuth 2.0 (company Google Workspace)
- **Validation:** Zod
- **Deployment:** Vercel

## Feature Status

### MVP Features

| ID | Feature | Status | Description |
|----|---------|--------|-------------|
| N4 | Project & Suite Management | Done | Create/edit/archive projects, suite management with prefixes, drag-and-drop reorder, color assignment |
| N2 | Test Case Management | Done | Full CRUD, step editor with autocomplete, inline grid editing, bulk edit, version history, bug links |
| N7 | User Management | Done | Invitation flow, Google OAuth onboarding, role assignment (Admin/SDET/QA Engineer/Viewer) |
| N3 | Test Execution Tracking | Done | Test runs, execution matrix (step x platform x browser), failure annotations with screenshot uploads |
| N6 | Grid View | Done | MUI X Data Grid Pro with tree data, column persistence, filtering, sorting, CSV export, inline editing |
| N1 | CSV Import | Done | 5-step wizard: upload, column mapping, review, import with progress, completion summary with error reporting |
| N5 | Basic Reporting | Done | KPI cards, platform comparison bar chart, status distribution donut chart, PDF/Excel export |
| N8 | Playwright Webhook | Done | POST endpoint with API key auth, async processing, auto-create test runs, event log UI |

### Future Features

| ID | Feature | Status | Description |
|----|---------|--------|-------------|
| S1 | Enhanced Playwright | Not Started | CI/CD build log linking, richer payload handling |
| S2 | Automated Test Triggering | Not Started | Trigger Playwright/GitLab CI runs from UI |
| S3 | Performance Testing | Not Started | k6/JMeter webhook integration, performance result dashboards |
| S4 | Slack Integration | Not Started | Run completion notifications, failure alerts |
| S5 | GitLab Integration | Not Started | Issue linking, MR status sync |
| S6 | Advanced Test Cases | Not Started | Templates, dependencies, custom fields |
| S7 | Collaboration | Not Started | Comments, activity feed, @mentions, notifications |

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- A [Supabase](https://supabase.com) project with the schema applied (see `docs/schema.md`)
- Google OAuth configured in Supabase Auth
- [MUI X Pro license](https://mui.com/x/introduction/licensing/)

### Setup

1. **Clone the repo**

   ```bash
   git clone https://github.com/JoinFullStackDev/TCM.git
   cd TCM
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**

   Copy the example and fill in your values:

   ```bash
   cp .env.example .env.local
   ```

   Required variables:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   NEXT_PUBLIC_MUI_X_LICENSE_KEY=your-mui-x-license-key
   WEBHOOK_API_KEY=your-webhook-api-key
   ```

4. **Run the dev server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

## Project Structure

```
src/
├── app/
│   ├── (auth)/          # Login, invite acceptance
│   ├── (dashboard)/     # Main app pages (projects, runs, reports, users)
│   └── api/             # API routes (test-cases, test-runs, webhooks, etc.)
├── components/
│   ├── test-cases/      # Grid, drawer, step editor, filters, edit cells
│   ├── execution/       # Status badges, execution matrix, annotations
│   ├── csv-import/      # Import wizard steps
│   ├── reports/         # KPI cards, charts, export
│   └── common/          # Shared UI (EmptyState, ConfirmDialog, etc.)
├── lib/
│   ├── supabase/        # Typed Supabase clients (server + browser)
│   ├── validations/     # Zod schemas
│   ├── csv/             # CSV parsing, column mapping, field parsers
│   └── api/             # API helpers, auth middleware
├── theme/               # MUI dark theme, palette, semantic colors
└── types/               # TypeScript type definitions
docs/
├── schema.md            # Full database ERD with tables, constraints, RLS
├── roadmap.md           # Build phases and sequencing
├── design-system.md     # Colors, animations, component styling
└── features/            # Per-feature specs (n1-n8, s1-s7)
```

## Role Hierarchy

```
Admin > SDET > QA Engineer > Viewer
```

- **Admin** — Full access + user management, project deletion
- **SDET** — QA Engineer + automation status management, webhook config
- **QA Engineer** — Test case CRUD, execution, reporting, suite management
- **Viewer** — Read-only everywhere, no edit controls visible

## Documentation

Detailed specs live in `docs/`:

- [`docs/schema.md`](docs/schema.md) — Full database schema with tables, constraints, indexes, and RLS policies
- [`docs/roadmap.md`](docs/roadmap.md) — Build phases and task sequencing
- [`docs/design-system.md`](docs/design-system.md) — Theme colors, animations, component patterns
- [`docs/features/`](docs/features/) — Per-feature acceptance criteria and UI notes
