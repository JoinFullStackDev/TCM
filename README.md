# TestForge — by FullStack

[![Vercel Deploy](https://deploy-badge.vercel.app/vercel/tcm-ochre?style=flat)](https://tcm-ochre.vercel.app)

QA operations platform — build, track, and ship quality. Replaces Google Sheets test plans with a purpose-built tool for ~20-25 users across 4 roles.

## Tech Stack

Next.js 16 (App Router) · MUI 7 + Data Grid Pro · Framer Motion · Supabase (Postgres, Auth, Storage) · Google OAuth 2.0 · Zod · Vercel

## Features

| Feature | Description |
|---------|-------------|
| **Dashboard** | Role-aware home page with modular cards — personal stats, global metrics, admin system overview. Single Postgres RPC, admin-customizable layout. |
| **Project & Suite Management** | Projects with suites, prefix-based ID generation (e.g. SR-1), drag-and-drop reorder, suite groups, suite merge |
| **Test Case Management** | Full CRUD, step editor with autocomplete, inline grid editing, bulk edit, version history, bug links |
| **Test Execution** | Test runs with assignee management, execution matrix (step x platform x browser), failure annotations with screenshots |
| **Grid View** | MUI X Data Grid Pro with tree data, column persistence, filtering (suite, status, platform, tags), sorting, CSV export |
| **CSV Import** | 5-step wizard: upload, column mapping, review, import with progress, error reporting |
| **Reporting** | KPI cards, platform bar chart, status donut chart, PDF/Excel export |
| **Playwright Webhook** | POST endpoint with API key auth, async processing, auto-create test runs, Slack notifications |
| **User Management** | Invitation flow, Google OAuth onboarding, role assignment (Admin / SDET / QA Engineer / Viewer) |

## Getting Started

```bash
git clone https://github.com/JoinFullStackDev/TCM.git && cd TCM
npm install
cp .env.example .env.local   # fill in Supabase + MUI X keys
npm run dev                   # http://localhost:3000
```

**Required env vars:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_MUI_X_LICENSE_KEY`, `WEBHOOK_API_KEY`

## Roles

| Role | Access |
|------|--------|
| **Admin** | Everything + user management, project deletion, dashboard customization |
| **SDET** | QA Engineer + automation management, webhook config |
| **QA Engineer** | Test case CRUD, execution, reporting, suite management |
| **Viewer** | Read-only — no edit controls, no write API access |

## Documentation

Detailed specs in `docs/`: [schema](docs/schema.md) · [roadmap](docs/roadmap.md) · [design system](docs/design-system.md) · [features](docs/features/)
