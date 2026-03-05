# S4: Slack Integration

**Priority:** Must Have (SOON — post-MVP)

## User Story

> As a QA Engineer, I want test run results posted to Slack so that the team is immediately aware of failures.

## Acceptance Criteria

### AC-1: Run Completion Notification

- Given I configure a Slack webhook for my project
- When a test run completes
- Then a notification is sent to the specified Slack channel with summary (total, passed, failed, blocked) and a link to a hosted HTML report with the test results

### AC-2: Failure Threshold Alert

- Given a critical test fails
- When the failure threshold is exceeded (e.g., >5 failures)
- Then an alert notification is sent to Slack with @mentions for assigned team members

### AC-3: Suite-Level Notification Config

- Given I want notifications only for specific suites
- When I configure suite-level Slack settings
- Then only runs for those suites trigger notifications

## Relationship to MVP

Requires a per-project integrations config table and a notification dispatch system. The MVP should include an `integrations` schema placeholder.
