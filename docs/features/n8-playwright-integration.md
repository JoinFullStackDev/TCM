# N8: Basic Playwright Automation Integration

**Priority:** Must Have (MVP)

## User Story

> As an SDET, I want Playwright test results to automatically update test case status so that I don't manually sync results.

## Acceptance Criteria

### AC-1: Automated Result Ingestion

- Given I have Playwright tests linked to test cases by ID
- When the Playwright CI/CD pipeline completes
- Then the system receives test results via API webhook

## UI & Design Notes

> Reference: [design-system.md](../design-system.md)

### Automation Status Indicators (in grid)

- Test cases updated by webhook show a small **Info** (violet/purple) icon indicating "auto-updated" next to the status badge
- Timestamp of last sync displayed in **Neutral** secondary text on hover

### Webhook Activity Log

- Integration settings page shows a webhook event log
- Each event row: timestamp, test run name, result summary
- Status indicator per event:
  - Successful sync: **Success** dot
  - Failed sync: **Error** dot with expandable error details
  - Pending/processing: **Warning** spinning indicator

### Automation-Updated Test Runs

- Test runs created from automation results are tagged with an **Info** "Automated" chip to distinguish from manual runs
- In the test runs list, automated runs have a subtle **Info** left border vs **Primary** for manual runs

---

## Implementation Status

The following capabilities are **built and functional**:

- **Webhook endpoint** — `POST /api/webhooks/playwright` with `X-API-Key` header auth
- **Zod validation** — Payload validated via schema in `lib/validations/webhook.ts`; invalid payloads rejected with structured errors
- **Event logging** — Every incoming request (success or failure) logged to `webhook_events` with status, error message, and timestamp
- **Auto-run creation** — Webhook results auto-create a `test_run` (`is_automated: true`, `source: 'playwright_webhook'`), `test_run_cases`, and `execution_results`
- **Webhook processing** — Core logic in `lib/webhooks/process-playwright.ts`
- **Activity log UI** — Integrations page (`/integrations`) shows webhook event history with status indicators
- **Automated run tagging** — Runs created via webhook display "Automated" chip in the UI

## Remaining Deferred Decisions

The following details remain **intentionally deferred** until CI/CD pipeline integration is production-hardened:

- **Test case ID mapping** — how the Playwright report references test case `display_id` values (e.g. `SR-1`) needs to be decided alongside the CI config. Current implementation uses display IDs in the payload.
- **Retry policy** — exponential back-off, dead-letter, max attempts will be defined when real failure modes are observable in production.
- **API key management** — `X-API-Key` header auth works with a static key (`WEBHOOK_API_KEY` env var). Key generation, rotation, and per-project scoping are deferred.
