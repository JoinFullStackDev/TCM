# N6: Grid View Interface

**Priority:** Must Have (MVP)

## User Story

> As a QA engineer, I want a grid view so that I can quickly scan and edit multiple tests.

## Acceptance Criteria

### AC-1: Customizable Grid

- Given I am viewing a test suite
- When the grid loads
- Then I see customizable columns with sort, filter, resize, and reorder capabilities

### AC-2: Filtering

- Given I want to filter test cases
- When I apply filters (by status, platform, automation status, assignee)
- Then only matching test cases display

### AC-3: CSV Export

- Given I need to export data
- When I select "Export to CSV"
- Then the current filtered view exports to CSV format

## UI & Design Notes

> Reference: [design-system.md](../design-system.md)

### Grid Surface

- Grid sits on a dark surface card (one elevation step above page background)
- 1px **Neutral** border, rounded 8px on the outer container
- Column headers: **Neutral** background (slightly lighter than surface), bold white text
- Row dividers: **Neutral** at 15% opacity (subtle, not harsh lines)
- Alternating rows: no striping — use consistent dark surface; hover provides contrast

### Row Interactions

- Hover: **Primary** wash at 8% opacity + faint **Primary** left border (150ms transition)
- Selected: **Primary** wash at 15% + solid **Primary** left border
- Multi-select: checkbox column with **Primary** accent on checked state, ripple animation (150ms)

### Collapsible Test Case Groups

- Group header row: slightly lighter surface, **suite accent color** left border (4px solid)
- Expand/collapse chevron: rotates 90° smoothly (250ms)
- Content rows animate in with height expansion + fade-in (250ms)

### Filter Bar

- Filter chips sit above the grid in a horizontal bar
- Active filters: chip filled with the **semantic color** of the filtered value
  - e.g., filtering by "Pass" → **Success** chip; "Blocked" → **Warning** chip; "IN CICD" → **Success** chip
- Inactive/available filters: **Neutral** outlined chips
- Clear all: small **Neutral** text button at the end

### Sort Indicators

- Active sort column: **Primary** arrow icon in the column header
- Column header hover: **Primary** text color transition (150ms)

### Status & Automation Columns

- Execution status cells: filled badge using status colors (Pass=**Success**, Fail=**Error**, Blocked=**Warning**, Skip=**Neutral**, Not Run=**Neutral**)
- Automation status cells: filled badge (IN CICD=**Success**, SCRIPTED=**Info**, OUT OF SYNC=**Warning**, None=**Neutral**)
- Combined platform status: side-by-side mini-badges with platform+status colors

### Column Resize & Reorder

- Resize handle: appears on hover as a **Primary** vertical line between column headers
- Reorder: drag column header, ghost follows cursor, drop zone highlighted with **Primary** dashed border

### CSV Export Button

- **Primary** outlined button with download icon in the grid toolbar
- On click: **Primary** pulse → **Success** toast on download complete
