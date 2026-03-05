# User Personas & Roles

## Roles Overview

| Role | Access Level |
|---|---|
| **Admin** | Full access — user management, project config, all QA Engineer + SDET capabilities |
| **QA Engineer** | Manual test execution, test case CRUD, reporting, suite management |
| **SDET** | Everything a QA Engineer can do, plus automation integration, CI/CD triggers, automation status management |
| **Viewer** | Read-only access to test cases and reports |

## Admin

- Invites users and manages user permissions
- Assigns roles (Admin, QA Engineer, SDET, Viewer)
- Configures project-level settings and integrations
- Has all QA Engineer and SDET capabilities

## QA Engineer

- Creates and edits test cases and suites
- Executes manual tests and records results
- Updates test status and logs defects
- Reviews feature coverage
- Oversees test planning across multiple projects
- Generates stakeholder reports
- Manages team assignments

## SDET

- Everything a QA Engineer can do, plus:
- Identifies test cases for automation (Playwright / performance)
- Updates automation status (`IN CICD`, `SCRIPTED`, `OUT OF SYNC`)
- Syncs automated test results back to test cases
- Triggers automated test runs from the tool (post-MVP: S2)
- Links test cases to automation code file paths
- Integrates with Playwright automation and performance test results

## Viewer

- Read-only access to test cases
- Read-only access to reports
- Cannot edit, create, or delete any data
