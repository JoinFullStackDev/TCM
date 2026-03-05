# S5: GitLab Integration

**Priority:** Must Have (SOON — post-MVP)

## User Story

> As a QA engineer, I want to link test failures to GitLab issues so that developers can track and fix bugs.

## Acceptance Criteria

### AC-1: Auto-Populated Issue Creation

- Given a test fails during execution
- When I click "Create GitLab Issue"
- Then the system pre-fills an issue with test case details, failure info, and a link to the test generated HTML report

### AC-2: Issue Linking

- Given I have an existing GitLab issue
- When I link it to a test case
- Then the issue URL is stored and the issue status syncs to the test case

### AC-3: Issue Closure Notification

- Given a test case is linked to a GitLab issue
- When the issue status changes to "Closed"
- Then the system optionally posts a comment noting the test can be re-run

### AC-4: Source Code File Linking

- Given I am an automation engineer
- When I link a test case to a GitLab repository file path
- Then the link opens the correct file in GitLab UI and I can see recent commits

## Relationship to MVP

The test case `bug_links` field from the CSV import (N1) should be designed to support structured issue references (not just free text URLs) so GitLab sync can build on it later.
