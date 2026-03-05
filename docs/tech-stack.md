# Tech Stack & Infrastructure

## Decisions

| Layer | Choice | Notes |
|---|---|---|
| **Frontend** | Next.js | Used successfully in other projects |
| **Design System** | [Material Design 3 (M3)](https://m3.material.io/) | Google's latest design language |
| **UI Library** | MUI | React implementation of Material Design; data grid for N6 |
| **Theme** | Dark mode, multi-accent palette | See [design-system.md](design-system.md) for full spec |
| **Animation** | Framer Motion (recommended) | Purposeful micro-interactions and transitions |
| **Backend / DB / Auth / Storage** | Supabase | Postgres, Auth, Storage (attachments/screenshots), Realtime, Edge Functions |
| **Authentication** | Google OAuth 2.0 | Company uses Google Workspace; all users have company Google accounts |
| **Hosting** | Vercel | Frontend + API routes |
| **Org Model** | Single-org internal tool | Not multi-tenant SaaS |

## Users & Scale

- ~20–25 users
- 4 roles: **Admin**, **QA Engineer**, **SDET**, **Viewer**
- 10+ projects per year
- Thousands of test cases per project
- MVP platforms: **Desktop** and **Tablet** (Mobile deferred to post-MVP)

## Authentication Details

- Google OAuth 2.0 via Supabase Auth
- Users authenticate with their company Google Workspace email
- GitLab and Slack accounts use the same company email but are **not** tied to Google sign-in (separate integration auth will be needed for S4/S5)

## File Storage (MVP)

Supabase Storage handles screenshot attachments for failure annotations (N3 AC-5):

- Bucket per project for organization
- Linked to specific test step + platform execution results
- Supabase Storage provides signed URLs, access control via RLS policies, and CDN delivery

## Key Implications

- **M3 + MUI + Dark Theme** — MUI components styled to M3 principles with a custom dark theme and multi-accent color palette. See [design-system.md](design-system.md) for palette, animation, and component styling details. The `@mui/x-data-grid` component is a strong candidate for the spreadsheet-like grid view (N6).
- **Supabase** handles Postgres, auth, file storage (screenshots/attachments), and row-level security — reduces infrastructure to manage
- **Next.js on Vercel** gives us SSR/ISR, API routes, and zero-config deployments
- **Row Level Security (RLS)** in Supabase can enforce role-based access at the database level alongside application-level checks
- **Google OAuth only** simplifies auth — no email/password flow needed, no password reset, etc.
