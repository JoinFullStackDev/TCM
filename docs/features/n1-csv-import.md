# N1: CSV Import of Existing Tests

**Priority:** Must Have (MVP)

## User Story

> As a QA Engineer, I want to import my existing Google Sheets test plans via CSV so that I don't have to manually recreate hundreds of test cases.

## Acceptance Criteria

### AC-1: File Upload & Column Mapping

- Given I have exported my Google Sheets test plan as CSV
- When I upload the CSV file to the import wizard
- Then the system parses the file and displays a column mapping interface

### AC-2: Auto-Detection of Columns

- Given the CSV contains columns matching our current structure (ID, Description, Precondition, Test Steps, etc.)
- When I review the auto-detected column mappings
- Then the system correctly maps standard columns with sensible defaults based on header names

### AC-3: Full Field Preservation

- Given I have reviewed and confirmed the column mappings
- When I initiate the import
- Then the system creates test cases with all fields preserved:
  - Test IDs
  - Descriptions
  - Preconditions
  - Step numbers
  - Step descriptions
  - Test data
  - Expected results
  - Pass/fail status
  - Comments
  - Bug links
  - Automation flags (`IN CICD`, `SCRIPTED`, `OUT OF SYNC`)
  - Execution dates
  - Platform tags (Desktop / Mobile / Tablet)

### AC-4: Duplicate Handling

- Given I import a CSV with existing test case IDs
- When the system detects duplicate IDs
- Then I am prompted to either update existing test cases or skip duplicates

### AC-5: Post-Import Verification

- Given the import completes successfully
- When I navigate to the test suite
- Then all imported test cases appear with correct data and no data loss

## UI & Design Notes

> Reference: [design-system.md](../design-system.md)

### Import Wizard

- Multi-step wizard using a **stepper component**
  - Active step: **Primary** accent fill
  - Completed step: **Success** accent with checkmark
  - Upcoming step: **Neutral** accent, muted
- Steps: Upload → Column Mapping → Review → Import → Done
- Step transitions: fade + slide animation (300ms)

### Column Mapping Screen

- Two-column layout: CSV columns on the left, system fields on the right
- Successfully auto-mapped columns: **Success** left border + checkmark icon
- Unmapped / needs-review columns: **Warning** left border + attention icon
- Drag-to-remap uses the drag-and-drop animation spec (lifted card + ghost)

### Import Progress

- Progress bar: **Primary → Success** gradient, fills left to right
- Live counter showing "X of Y test cases imported"
- Skeleton shimmer on the progress area while parsing

### Duplicate Handling

- Duplicates flagged with **Warning** badge on each affected row
- Action buttons: "Update Existing" (**Primary** outlined) / "Skip" (**Neutral** outlined)

### Completion

- **Success** toast notification: "X test cases imported successfully"
- If partial failures: **Warning** toast with count and link to error details
- If full failure: **Error** toast with details
