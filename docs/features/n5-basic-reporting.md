# N5: Basic Reporting

**Priority:** Must Have (MVP)

## User Story

> As a QA Engineer, I want to generate test execution reports so that I can share status with stakeholders.

## Acceptance Criteria

### AC-1: Report Generation

- Given I select a test run
- When I click "Generate Report"
- Then the system produces a summary with:
  - Total test cases
  - Pass / fail / blocked counts
  - Platform-specific metrics
  - Pass rate percentage

### AC-2: Platform Comparison Visualization

- Given I want platform comparison data
- When I view the platform report
- Then I see a bar chart comparing pass rates across Desktop, Mobile, and Tablet

### AC-3: Report Export

- Given I need to share the report
- When I select "Export to PDF" or "Export to Excel"
- Then the report downloads in the selected format

## UI & Design Notes

> Reference: [design-system.md](../design-system.md)

### Report Dashboard

- Report page uses a card-based layout for KPI summary at the top
- KPI cards (total, pass, fail, blocked, pass rate):
  - Dark surface, 1px **Neutral** border, rounded 8px
  - Each card has a left border accent matching its semantic color:
    - Total: **Primary**
    - Passed: **Success**
    - Failed: **Error**
    - Blocked: **Warning**
    - Pass rate: **Success** if ≥80%, **Warning** if 50–79%, **Error** if <50%
  - Numbers are large, white, bold; label below in **Neutral** secondary text
- Cards animate in on page load with a staggered fade-up (50ms stagger per card)

### Platform Comparison Bar Chart (AC-2)

- Desktop bar: **Primary** (blue/indigo)
- Tablet bar: **Info** (violet/purple)
- Mobile bar (future): **Success** (teal/green)
- Chart background: page surface with **Neutral** grid lines at 30% opacity
- Bars animate in sequentially (stagger 50ms each, 400ms total)
- Hover tooltip: frosted glass panel with detailed breakdown

### Pass/Fail Donut Chart

- Pass segment: **Success**
- Fail segment: **Error**
- Blocked segment: **Warning**
- Skip/Not Run segment: **Neutral**
- Center label shows pass rate percentage in white bold text
- Segments animate in with a clockwise wipe (400ms)

### Export Buttons

- "Export to PDF": **Primary** outlined button with PDF icon
- "Export to Excel": **Primary** outlined button with spreadsheet icon
- On click: brief **Primary** pulse, then download starts with **Success** toast confirmation
