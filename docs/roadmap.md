# Build Roadmap

> Sequenced build plan for TCM MVP (N1–N8). Each phase lists what gets built, which schema tables are involved, and what's deliverable at the end. Later phases depend on earlier ones — don't skip ahead.

---

## Phase 0 — Foundation

**Goal:** Runnable app shell with auth, theme, and full database — no features yet, but the skeleton everything mounts into.

### Deliverables

| # | Task | Schema / Config |
|---|------|-----------------|
| 0.1 | Next.js App Router scaffold, install deps (MUI, Framer Motion, Supabase SSR, MUI X Data Grid, Zod) | `package.json` |
| 0.2 | Supabase project config — env vars, typed client (server + browser) | `.env.local`, `lib/supabase/` |
| 0.3 | Full database migration — all enums, MVP tables, future placeholder tables, indexes, constraints | All enums: `user_role`, `test_case_type`, `automation_status`, `execution_status`, `platform`, `invitation_status`, `test_run_status`, `webhook_event_status`, `import_status` |
| 0.4 | Database functions & triggers | `generate_test_case_id()`, `update_updated_at()`, `create_profile_on_signup()`, `snapshot_test_case_version()` |
| 0.5 | RLS policies for all tables | See `schema.md` RLS Policy Guide |
| 0.6 | MUI dark theme — backgrounds (`#0A0A0F`–`#111118`), accent palette, component overrides, typography | `theme/` |
| 0.7 | Google OAuth flow — sign in, sign out, session handling, middleware route protection | `profiles` (auto-created via trigger) |
| 0.8 | RBAC utilities — `hasPermission()` server helper, middleware role check, client-side role context | `profiles.role` |
| 0.9 | App shell — layout, sidebar nav placeholder, top bar (avatar, sign-out), project switcher placeholder | No tables — pure UI |
| 0.10 | Framer Motion base — page transition wrapper, shared animation variants | `lib/animations/` |

### Tables Created (migration runs all at once)

**MVP tables:** `profiles`, `invitations`, `projects`, `suites`, `test_cases`, `test_steps`, `test_runs`, `test_run_cases`, `execution_results`, `annotations`, `attachments`, `test_case_versions`, `bug_links`, `csv_imports`, `csv_import_errors`, `webhook_events`, `grid_column_preferences`

**Future placeholders (empty):** `integrations`, `comments`, `activity_log`, `notifications`, `custom_field_definitions`, `custom_field_values`, `test_case_dependencies`

### Exit Criteria

- App boots at `localhost:3000` with dark theme
- Google sign-in works, profile row created in `profiles`
- Unauthenticated users redirected to login
- Sidebar and top bar render, no feature content yet
- All database tables exist with RLS enforced
- `npm run build` passes with no errors

---

## Phase 1 — Core Data Hierarchy (N4 → N2)

**Goal:** Projects, suites, and full test case CRUD — the backbone of the app.

### N4: Project & Suite Management

| # | Task | Schema |
|---|------|--------|
| 1.1 | Project list page — create, edit, archive | `projects` |
| 1.2 | Suite management — create with prefix, edit, reorder, color assignment | `suites` (`prefix`, `color_index`, `position`, `next_sequence`) |
| 1.3 | Sidebar tree — project → suites hierarchy, suite click navigates to suite view | `projects` → `suites` join |
| 1.4 | `generate_test_case_id()` integration — verify atomic ID generation | `suites.next_sequence` → `test_cases.display_id` |
| 1.5 | Drag-and-drop reorder for suites | `suites.position` |

### N2: Test Case Management

| # | Task | Schema |
|---|------|--------|
| 1.6 | Test case list within suite | `test_cases` (filtered by `suite_id`) |
| 1.7 | Create test case — auto-generated `display_id`, title, description, precondition | `test_cases`, `suites.next_sequence` |
| 1.8 | Step management — add/edit/reorder/delete steps | `test_steps` (`step_number`, `description`, `test_data`, `expected_result`, `is_automation_only`) |
| 1.9 | Test case detail drawer — full edit form with all fields | `test_cases` all columns |
| 1.10 | Inline editing — double-click cells in the list view | `test_cases`, `test_steps` |
| 1.11 | Auto-save with version history | `test_case_versions` (`snapshot`, `version_number`, `changed_by`) via `snapshot_test_case_version()` trigger |
| 1.12 | Bulk edit — multi-select and batch update fields | `test_cases` batch UPDATE |
| 1.13 | Automation status & platform tags | `test_cases.automation_status`, `test_cases.platform_tags` |
| 1.14 | Bug links — add/remove external URLs | `bug_links` (`url`, `provider`, `external_id`) |
| 1.15 | Reusable step autocomplete | `test_steps.description` via GIN trigram index |

### Exit Criteria

- Can create projects and suites with unique prefixes
- Test cases get auto-generated IDs (e.g. SR-1, SR-2)
- Full CRUD on test cases and steps
- Version history records changes automatically
- Viewer role cannot create/edit — UI controls hidden, API returns 403
- `npm run build` passes with no errors

---

## Phase 2 — Users & Execution (N7 → N3)

**Goal:** Multi-user support and the full execution tracking workflow.

### N7: User Management

| # | Task | Schema |
|---|------|--------|
| 2.1 | User list page (Admin only) — table of all profiles with role badges | `profiles` |
| 2.2 | Invitation flow — Admin sends invite, email sent, token generated | `invitations` (`email`, `role`, `token`, `expires_at`, `status`) |
| 2.3 | Invitation acceptance — user signs in with Google, profile linked to invitation role | `invitations.status` → `accepted`, `profiles.role` updated |
| 2.4 | Role assignment — Admin changes user role | `profiles.role` UPDATE |
| 2.5 | Viewer enforcement — verify all write UI hidden, all write APIs return 403 | RLS policies + middleware |

### N3: Test Execution Tracking

| # | Task | Schema |
|---|------|--------|
| 2.6 | Test run creation — name, description, version, environment, dates, assignee, suite scope | `test_runs` (`project_id`, `suite_id`, `name`, `target_version`, `environment`, `status`, `start_date`, `due_date`, `assignee_id`) |
| 2.7 | Test run case selection — pick which cases to include | `test_run_cases` (`test_run_id`, `test_case_id`, `overall_status`) |
| 2.8 | Execution result matrix — step × platform × browser grid | `execution_results` (`test_step_id`, `platform`, `browser`, `status`) |
| 2.9 | Step-level status recording — Pass/Fail/Blocked/Skip/Not Run per cell | `execution_results.status` UPDATE |
| 2.10 | Failure annotations — comment + screenshot upload on fail | `annotations` (`execution_result_id`, `comment`) + `attachments` (`storage_path`, `file_name`, `mime_type`) |
| 2.11 | Supabase Storage setup — screenshot bucket, upload/signed-URL flow | Storage: `screenshots/{project_id}/{test_run_id}/{annotation_id}_{filename}` |
| 2.12 | Combined status display — aggregate step results into case-level and run-level status | `test_run_cases.overall_status` computed from `execution_results` |
| 2.13 | Test run status lifecycle — planned → in_progress → completed/aborted | `test_runs.status`, `test_runs.completed_at` |

### Exit Criteria

- Admin can invite users, assign roles
- New user signs in with Google → gets invited role
- Viewer confirmed locked out of all writes
- Test runs can be created, cases selected, results recorded per step × platform
- Screenshots upload to Supabase Storage and display inline
- `npm run build` passes with no errors

---

## Phase 3 — Primary Interface (N6)

**Goal:** The MUI X Data Grid that becomes the daily-use screen.

### N6: Grid View

| # | Task | Schema |
|---|------|--------|
| 3.1 | Data Grid setup — MUI X Data Grid Pro with test case rows | `test_cases` + `test_steps` (count) + `execution_results` (latest status) |
| 3.2 | Collapsible suite groups — rows grouped by suite with colored headers | `suites.color_index`, `suites.name` |
| 3.3 | Column customization — resize, reorder, show/hide columns | `grid_column_preferences` (`user_id`, `project_id`, `suite_id`, `column_config` JSONB) |
| 3.4 | Filtering — status, platform, automation status, assignee, tags | Query params on `test_cases`, `execution_results` |
| 3.5 | Sorting — by any column | Client-side via Data Grid |
| 3.6 | Status badges — execution status, automation status, platform icons inline | `test_cases.automation_status`, `execution_results.status`, `test_cases.platform_tags` |
| 3.7 | Row interactions — click to open detail drawer (N2), hover preview | Links to N2 drawer |
| 3.8 | Export filtered view to CSV | Client-side export of current grid state |

### Exit Criteria

- Grid renders all test cases grouped by suite
- Columns resizable, reorderable, persistent per user
- Filters work across all key fields
- Status badges render with correct colors from design system
- CSV export works for filtered views
- `npm run build` passes with no errors

---

## Phase 4 — Data Migration & Reporting (N1 → N5)

**Goal:** Import existing Google Sheets data and generate reports from execution data.

### N1: CSV Import

| # | Task | Schema |
|---|------|--------|
| 4.1 | CSV upload UI — file picker, drag-and-drop | Client-side only |
| 4.2 | CSV parser — handle repeating column headers, multi-line fields, the real Sheets export structure (see `docs/_CSV-example.csv`) | Client-side parsing |
| 4.3 | Column mapping wizard — auto-detect standard columns, manual override | `csv_imports.column_mappings` JSONB |
| 4.4 | Import preview — show parsed data before committing | Client-side display |
| 4.5 | Import execution — create/update test cases, steps, bug links; handle duplicates | `test_cases`, `test_steps`, `bug_links`, `suites.next_sequence` |
| 4.6 | Platform result parsing — split `"Pass Tablet, Pass Desktop, Fail Mobile"` into per-platform execution results | `execution_results` per platform |
| 4.7 | Automation status mapping — `IN CICD` → `in_cicd`, `SCRIPTED` → `scripted`, `OUT OF SYNC` → `out_of_sync` | `test_cases.automation_status` |
| 4.8 | `**Automation Only**` step handling — set `is_automation_only = true` | `test_steps.is_automation_only` |
| 4.9 | Import tracking & error reporting — row-level errors, summary counts | `csv_imports` (`total_rows`, `imported_count`, `skipped_count`, `error_count`, `status`) + `csv_import_errors` (`row_number`, `error_message`, `raw_data`) |
| 4.10 | Post-import verification — review what was imported, error report | `csv_imports`, `csv_import_errors` |

### N5: Basic Reporting

| # | Task | Schema |
|---|------|--------|
| 4.11 | Summary KPIs — total cases, pass/fail/blocked counts, pass rate | Aggregates on `execution_results.status`, `test_run_cases.overall_status` |
| 4.12 | Platform comparison chart — bar chart per platform | Aggregates on `execution_results` grouped by `platform` |
| 4.13 | Status distribution donut chart | Aggregates on `execution_results.status` |
| 4.14 | Export to PDF / Excel | Client-side generation from report data |

### Exit Criteria

- CSV from real Google Sheets export (see `_CSV-example.csv`) imports correctly — suite detection, step parsing, platform results, automation flags, bug links
- Import wizard shows progress, handles errors per row
- Reports show accurate KPIs, charts render with design system colors
- Export produces valid PDF and Excel files
- `npm run build` passes with no errors

---

## Phase 5 — Integration (N8)

**Goal:** Playwright webhook endpoint — structural shell with deferred payload contract.

### N8: Playwright Webhook

| # | Task | Schema |
|---|------|--------|
| 5.1 | Webhook endpoint — `POST /api/webhooks/playwright` with API key auth (`X-API-Key`) | `webhook_events` (`project_id`, `provider`, `event_type`, `payload`, `status`) |
| 5.2 | Zod validation shell — placeholder schema, strict validation of what's defined | Zod schema in `lib/validations/` |
| 5.3 | Event logging — every request logged regardless of success/failure | `webhook_events.status`, `webhook_events.error_message` |
| 5.4 | Async processing pattern — return 202 immediately, process in background | `webhook_events.processed_at` |
| 5.5 | Auto-create test run from webhook results (when payload contract is defined) | `test_runs` (`is_automated = true`, `source = 'playwright_webhook'`) |
| 5.6 | Webhook activity log UI — event list with status indicators | `webhook_events` query |
| 5.7 | Auto-updated indicator — icon on test cases updated via webhook | `test_runs.is_automated` badge in grid |

### ⚠ Deferred Decisions (see `docs/features/n8-playwright-integration.md`)

- Exact webhook payload schema — TBD when CI pipeline is configured
- Test case ID mapping strategy (how Playwright references `display_id`)
- Retry policy (exponential back-off, dead-letter, max attempts)
- API key generation, rotation, and per-project scoping

### Exit Criteria

- Webhook endpoint accepts POST with API key auth
- All requests logged to `webhook_events`
- Invalid payloads rejected with structured error
- Activity log UI shows event history
- Automated test runs tagged with "Automated" chip
- `npm run build` passes with no errors

---

## Quick Reference: Schema → Phase Map

| Table | Phase | Feature |
|-------|-------|---------|
| `profiles` | 0 | Auth (auto-created via trigger) |
| `invitations` | 2 | N7 User Management |
| `projects` | 1 | N4 Project/Suite Mgmt |
| `suites` | 1 | N4 Project/Suite Mgmt |
| `test_cases` | 1 | N2 Test Case Mgmt |
| `test_steps` | 1 | N2 Test Case Mgmt |
| `test_case_versions` | 1 | N2 Auto-save/versioning |
| `bug_links` | 1 | N2 Test Case Mgmt |
| `test_runs` | 2 | N3 Execution Tracking |
| `test_run_cases` | 2 | N3 Execution Tracking |
| `execution_results` | 2 | N3 Execution Tracking |
| `annotations` | 2 | N3 Failure annotations |
| `attachments` | 2 | N3 Screenshot uploads |
| `csv_imports` | 4 | N1 CSV Import |
| `csv_import_errors` | 4 | N1 CSV Import |
| `webhook_events` | 5 | N8 Playwright Integration |
| `grid_column_preferences` | 3 | N6 Grid View |
| `integrations` | — | Future (S4/S5) |
| `comments` | — | Future (S7) |
| `activity_log` | — | Future (S7) |
| `notifications` | — | Future (S7) |
| `custom_field_definitions` | — | Future (S6) |
| `custom_field_values` | — | Future (S6) |
| `test_case_dependencies` | — | Future (S6) |

## Quick Reference: Enum → Phase Map

| Enum | Phase | Used By |
|------|-------|---------|
| `user_role` | 0 | `profiles.role`, `invitations.role` |
| `test_case_type` | 1 | `test_cases.type` |
| `automation_status` | 1 | `test_cases.automation_status` |
| `execution_status` | 2 | `execution_results.status`, `test_run_cases.overall_status` |
| `platform` | 2 | `execution_results.platform`, `test_cases.platform_tags` |
| `test_run_status` | 2 | `test_runs.status` |
| `invitation_status` | 2 | `invitations.status` |
| `webhook_event_status` | 5 | `webhook_events.status` |
| `import_status` | 4 | `csv_imports.status` |
