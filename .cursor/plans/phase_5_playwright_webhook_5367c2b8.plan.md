---
name: Phase 5 Playwright Webhook
overview: Build the Playwright webhook endpoint (N8) with API key auth, event logging, a placeholder processing pipeline, the webhook activity log UI, and automated test run tagging -- completing the final MVP feature.
todos:
  - id: p5-endpoint-auth
    content: 5.1 -- Webhook endpoint (POST /api/webhooks/playwright) with X-API-Key auth, service-role Supabase client, event logging on every request, WEBHOOK_API_KEY env var
    status: completed
  - id: p5-validation-processing
    content: 5.2 -- Zod validation shell for webhook payload + process-playwright.ts processing logic (auto-create test run, match test cases, create run_cases/results, update event status)
    status: completed
  - id: p5-activity-log
    content: "5.3 -- Webhook activity log UI: GET /api/webhooks/events route, integrations page, WebhookEventLog component with status dots and expandable error details"
    status: completed
  - id: p5-automated-indicator
    content: "5.4 -- Automated run indicator: Automated chip on TestRunCard, info left border for webhook runs, pass is_automated through runs list"
    status: completed
  - id: p5-navigation
    content: 5.5 -- Add Integrations nav item to Sidebar (view_webhooks only), TopBar breadcrumbs for /integrations
    status: completed
  - id: p5-verify
    content: "5.6 -- Final verification: webhook accepts/rejects/logs correctly, activity log renders, Automated chip shows, RBAC enforced, npm run build clean"
    status: completed
isProject: false
---

# Phase 5 -- Integration (N8: Playwright Webhook)

## Context

Phase 5 is the final MVP phase, covering **N8: Basic Playwright Automation Integration**. Per the feature spec and roadmap, several design decisions are **intentionally deferred** (exact payload schema, test case ID mapping, retry policy, key rotation). The goal is to build a robust structural shell that logs every request, validates what it can, and is ready to lock down the contract once the CI pipeline shape is known.

The `webhook_events` table already exists from Phase 0 with columns: `id`, `project_id`, `test_run_id`, `provider`, `event_type`, `payload` (JSONB), `status` (enum: pending/processing/success/failed), `error_message`, `processed_at`, `created_at`. RLS restricts SELECT to admin + sdet roles.

Existing RBAC permissions in [src/lib/auth/rbac.ts](src/lib/auth/rbac.ts) include `view_webhooks` (sdet, admin) and `manage_webhooks` (admin). The `TestRun` type already has `is_automated: boolean` and `source: string` fields.

---

## 5.1 -- Webhook Endpoint + API Key Auth

**New API route:** `POST /api/webhooks/playwright` (`src/app/api/webhooks/playwright/route.ts`)

- **Auth:** Does NOT use the standard `withAuth()` (no user session). Instead, validates an `X-API-Key` header against an env var `WEBHOOK_API_KEY`.
- Add `WEBHOOK_API_KEY` to `.env.local` and `.env.example`
- On every request (valid or not), log a `webhook_events` row using the Supabase service role client (since there's no user session). This requires creating a service-role Supabase client utility.
- On valid API key: parse body, validate with Zod, set status to `pending`, return `202 Accepted` with the event ID
- On invalid API key: log event with status `failed`, error message "Invalid API key", return `401`
- On validation failure: log event with status `failed`, error message from Zod, return `400`

**Service-role client:** `src/lib/supabase/service.ts` -- creates a Supabase client using `SUPABASE_SERVICE_ROLE_KEY` for use in webhook routes and background processing (never exposed to browser).

---

## 5.2 -- Zod Validation Shell + Payload Processing

**Zod schema:** `src/lib/validations/webhook.ts`

A placeholder schema that validates the structural envelope while leaving the results payload flexible:

- `project_id`: required UUID (must reference a real project)
- `event_type`: `"test_run_completed"` (extensible enum)
- `run_name`: optional string (name for the auto-created test run)
- `results`: array of `{ test_case_id: string, status: "pass" | "fail" | "skip" | "blocked", steps?: array }` -- validated loosely since the contract is TBD
- `metadata`: optional object (CI info, commit hash, etc.)

**Processing logic** (`src/lib/webhooks/process-playwright.ts`):

1. Validate `project_id` exists
2. Auto-create a test run: `is_automated = true`, `source = 'playwright_webhook'`, `status = 'completed'`
3. For each result in `results[]`:
  - Look up test case by `display_id` match
  - Create `test_run_cases` row with the status
  - Optionally create `execution_results` if step-level data is provided
4. Update `webhook_events` row: set `status = 'success'`, `processed_at = now()`, link `test_run_id`
5. On any error: set `status = 'failed'`, store error message

---

## 5.3 -- Webhook Activity Log UI

**Page:** `src/app/(dashboard)/integrations/page.tsx` -- integration settings / webhook log

Visible only to users with `view_webhooks` permission (sdet + admin).

**Layout:**

- Page header: "Integrations" with subtitle about webhook configuration
- Webhook URL display: shows the endpoint URL with a copy button
- API key section: shows masked key with copy button (admin only via `manage_webhooks`)
- Event log table below

**API route:** `GET /api/webhooks/events` (`src/app/api/webhooks/events/route.ts`)

- Requires `view_webhooks` permission
- Returns `webhook_events` ordered by `created_at` desc, joined with test run name if linked
- Supports `?project_id=` filter

**Component:** `src/components/webhooks/WebhookEventLog.tsx`

- Table with columns: timestamp, event type, project, status indicator, result summary
- Status dots per the design spec:
  - `success`: success-colored dot
  - `failed`: error-colored dot with expandable error details
  - `pending`/`processing`: warning-colored spinning indicator
- Click to expand shows full payload JSON and error message if any

---

## 5.4 -- Automated Run Indicator in UI

**TestRunCard updates** ([src/components/test-runs/TestRunCard.tsx](src/components/test-runs/TestRunCard.tsx)):

- Add `is_automated` and `source` to the card props
- When `is_automated === true`: show an **Info** (violet) "Automated" chip next to the status badge, and apply a subtle info-colored left border instead of default

**Runs list page** ([src/app/(dashboard)/runs/page.tsx](src/app/(dashboard)/runs/page.tsx)):

- Pass `is_automated` through to TestRunCard from the API response (already available on the `test_runs` table)

**Grid view** (optional, light touch): In the test case grid, if a test case was last updated by a webhook-created test run, an info-colored automation sync icon could appear -- but this is deferred per the spec's note about the mapping strategy being TBD. Just wire the `is_automated` flag on test runs for now.

---

## 5.5 -- Sidebar + Navigation

- Add "Integrations" nav item to [src/components/layout/Sidebar.tsx](src/components/layout/Sidebar.tsx), visible only when `can('view_webhooks')` is true, with a webhook/settings icon, linking to `/integrations`
- TopBar breadcrumbs: handle `/integrations` path

---

## 5.6 -- Verification

- `POST /api/webhooks/playwright` with valid API key + valid body returns 202 and creates a `webhook_events` row
- `POST` without API key returns 401 and still logs the event
- `POST` with invalid body returns 400 with Zod error details, logs the event
- Activity log page shows all events with correct status indicators
- Auto-created test runs show "Automated" chip in the runs list
- Viewer and QA Engineer cannot access the integrations page (redirect or hidden nav)
- `.env.local` has `WEBHOOK_API_KEY`
- `npm run build` passes with zero errors and zero warnings

---

## New/Modified Files Summary

```
NEW:
  src/lib/supabase/service.ts                          -- service-role Supabase client
  src/lib/validations/webhook.ts                       -- Zod schema for webhook payload
  src/lib/webhooks/process-playwright.ts               -- webhook processing logic
  src/app/api/webhooks/playwright/route.ts             -- POST endpoint with API key auth
  src/app/api/webhooks/events/route.ts                 -- GET webhook event log
  src/app/(dashboard)/integrations/page.tsx            -- webhook activity log page
  src/components/webhooks/WebhookEventLog.tsx           -- event log table component

MODIFIED:
  src/components/test-runs/TestRunCard.tsx              -- add Automated chip + info border
  src/app/(dashboard)/runs/page.tsx                    -- pass is_automated to card
  src/components/layout/Sidebar.tsx                    -- add Integrations nav item
  src/components/layout/TopBar.tsx                     -- breadcrumbs for /integrations
  .env.local / .env.example                            -- add WEBHOOK_API_KEY
```

