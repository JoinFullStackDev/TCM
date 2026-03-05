# N3: Test Execution Tracking

**Priority:** Must Have (MVP)

## User Story

> As a QA engineer, I want to create test runs and track execution across Desktop and Tablet platforms so that I can document platform-specific results.

**MVP Scope:** Desktop and Tablet only. Mobile platform support deferred to post-MVP.

## Acceptance Criteria

### AC-1: Test Run Creation

- Given I select a test suite
- When I click "Create Test Run"
- Then I can set metadata:
  - Name
  - Description
  - Target version
  - Environment (Desktop / Tablet — extensible to Mobile later)
  - Start date
  - Due date
  - Assignee

### AC-2: Step-Level Status Tracking

- Given I am executing a test run
- When I mark a test step as Pass, Fail, Blocked, Skip, or Not Run
- Then the step status updates immediately

### AC-3: Cross-Platform & Cross-Browser Tracking

- Given I execute the same test on Desktop and Tablet across multiple browsers/devices
- When I record results for each platform and browser/device combination
- Then the system tracks status independently per platform and browser/device type

### AC-4: Execution Result Matrix

- Given I have recorded results for a test across multiple platforms and browser/device types
- When I view the detailed execution results for that test
- Then the system displays a matrix/grid where rows represent browser/device types and columns represent platforms, with each cell showing the status for that combination

### AC-5: Failure Annotations

- Given a test step fails on a specific platform
- When I add a comment and attach a screenshot
- Then the comment and attachment are linked to that specific step and platform

### AC-6: Combined Status Display

- Given I view the test case in grid view
- When platform executions are complete
- Then I see combined status display (e.g., "Pass Desktop, Fail Tablet")

## UI & Design Notes

> Reference: [design-system.md](../design-system.md)

### Test Run Creation

- "Create Test Run" button: **Primary** filled
- Form opens as a modal (scale 95%→100% + fade, 250ms)
- Environment selector chips: **Primary** (Desktop), **Info** (Tablet) — color-coded to platform
- Date pickers: **Primary** accent on selected date

### Step Status Badges

| Status | Color | Visual |
|---|---|---|
| Pass | **Success** (teal/green) | Filled badge, checkmark icon |
| Fail | **Error** (coral/red) | Filled badge, X icon |
| Blocked | **Warning** (amber/golden) | Filled badge, block icon |
| Skip | **Neutral** (slate) | Outlined badge, skip icon |
| Not Run | **Neutral** (lighter) | Outlined badge, dash icon |

- Status change triggers a color morph + brief pulse/glow animation (200ms)
- Status badges use accent color at ~20% background with full-color text/icon

### Execution Result Matrix (AC-4)

- Column headers tinted by platform color: **Primary** (Desktop), **Info** (Tablet)
- Each cell is a status badge (colors above)
- Row headers (browser/device) in primary text color
- Matrix surface: one elevation step above page background
- Hover on a cell: tooltip with execution details, frosted glass style

### Combined Status Display (AC-6)

- Inline in the grid as side-by-side mini-badges: e.g., `[✓ Desktop]` in **Primary** tint + `[✗ Tablet]` in **Info** tint, where the badge fill uses the execution status color
- If all platforms pass: single **Success** badge "All Pass"
- If mixed: individual platform badges with their status colors

### Failure Annotations (AC-5)

- Comment input: text area with **Neutral** border, focuses to **Primary** border
- Screenshot upload: drag-and-drop zone with dashed **Neutral** border, hover turns **Primary**
- Attached screenshots: thumbnail grid with **Neutral** rounded border
- Annotation linked badge: **Error** tinted label showing "Desktop — Step 3" (platform color + step ref)
