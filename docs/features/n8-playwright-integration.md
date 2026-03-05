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

## ⚠ Open Design Decisions

The following details are **intentionally deferred** until CI/CD pipeline integration begins:

- **Webhook payload schema** — the exact JSON structure sent by Playwright CI is TBD. Design the ingestion endpoint to validate with Zod so the contract can be locked down once the pipeline shape is known.
- **Test case ID mapping** — how the Playwright report references test case `display_id` values (e.g. `SR-1`) needs to be decided alongside the CI config.
- **Error handling & retries** — retry policy (exponential back-off, dead-letter, max attempts) will be defined when real failure modes are observable.
- **Auth mechanism details** — `X-API-Key` header is confirmed; key generation, rotation, and per-project scoping are deferred.

These gaps are tracked and will be resolved during N8 implementation. Do not block other features on them.
