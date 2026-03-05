# S7: Collaboration Features

**Priority:** SOON (post-MVP)

## User Story

> As a QA engineer, I want to comment on test cases and @mention teammates so that I can collaborate effectively.

## Acceptance Criteria

### AC-1: Comments with @Mentions

- Given I have a question about a test case
- When I add a comment with @mention
- Then the mentioned user receives an email/Slack notification

### AC-2: Activity Feed

- Given I want to see recent team activity
- When I view the activity feed
- Then I see recent test case changes, test runs, and comments with real-time updates

## Relationship to MVP

- The version history system in N2 (auto-save with user tracking) should write to an audit/activity log that this feature can surface later.
- Plan a polymorphic `comments` table and a `notifications` dispatch queue in the schema.
