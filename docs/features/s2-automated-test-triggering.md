# S2: Automated Test Triggering (Playwright + GitLab CI)

**Priority:** Must Have (SOON — post-MVP)

## User Story

> As a QA engineer, I want to trigger automated Playwright suites from the test management tool so that I can run smoke/regression tests on demand and see the results in one place.

## Acceptance Criteria

### AC-1: Trigger Pipeline

- Given I am viewing a test suite that has been mapped to an automated Playwright suite in GitLab CI and no other automated tests are running on that project
- When I click the "Run Automated Tests" action for that suite
- Then the system calls the configured GitLab pipeline trigger for that project and passes parameters such as suite name, branch, and environment

### AC-2: Queue When Busy

- Given I am viewing a test suite that has been mapped to an automated Playwright suite in GitLab CI and an automated test is running on that project
- When I click the "Run Automated Tests" action for that suite
- Then the system queues the test to run when the currently running test is finished

### AC-3: Auto-Update from Pipeline Results

- Given the GitLab pipeline for Playwright tests has started from "Run Automated Tests" trigger
- When the system processes the results
- Then test case statuses update automatically and a test run is created with execution details

### AC-4: Failure Details & Log Links

- Given a Playwright test fails
- When the pipeline finishes execution
- Then the test management tool receives the results and updates a corresponding automated test run with pass/fail status, logs, and links to the GitLab pipeline

### AC-5: Run Detail View

- Given an automated test run was started from the test management tool
- When I open the run details
- Then I see each mapped test case's status updated (Pass/Fail) and a direct link to the Playwright trace/GitLab job logs for debugging

### AC-6: Tag-Based Filtering (Smoke / Regression)

- Given I have smoke and regression tags defined in my Playwright tests
- When I trigger an automated run from the tool and choose "Smoke" as the type within a project
- Then the system passes the appropriate tag or filter configuration to GitLab/Playwright so only smoke tests are executed for that project run

## Relationship to MVP

Depends on S1 and N8. The MVP should store suite-to-pipeline mapping config even if triggering isn't built yet.
