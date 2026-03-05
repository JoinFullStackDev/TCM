# N2: Test Case Management

**Priority:** Must Have (MVP)

## User Story

> As a QA engineer, I want to create and edit test cases in a spreadsheet-like interface so that I can work efficiently.

## Acceptance Criteria

### AC-1: Test Case Creation

- Given I am viewing a test suite
- When I click "Create Test Case"
- Then I can enter all required fields:
  - Test Case ID (auto-generated with project prefix)
  - Description
  - Precondition
  - Test Steps (unlimited, numbered)
  - Test Data per step
  - Expected Results per step
  - Automation Status
  - Platform tags
  - Per-step "Automation Only" flag (marks steps that are skipped during manual execution)

### AC-2: Inline Editing

- Given I am viewing the test case grid
- When I double-click a cell
- Then I can edit the value inline

### AC-3: Auto-Save with Version History

- Given I have made changes to a test case
- When the auto-save triggers
- Then changes are saved with version history including user who made changes

### AC-4: Bulk Edit

- Given I select multiple test cases
- When I choose "Bulk Edit"
- Then I can update common fields across all selected test cases

### AC-5: Reusable Step Autocomplete

- Given I am entering test steps for a new or existing test case
- When I start typing a step description that is similar to a previously used step (e.g., "Login as", "Click button")
- Then the system detects matching reusable steps and offers autocomplete suggestions so I can quickly insert an existing step with its text and metadata

## UI & Design Notes

> Reference: [design-system.md](../design-system.md)

### Test Case Creation Modal/Drawer

- Opens as a side drawer (slides in from right, 250ms scale + fade)
- "Create Test Case" button: **Primary** filled
- Form fields on dark surface (one elevation step above background)
- Auto-generated ID displayed with **Neutral** chip showing suite prefix

### Inline Editing

- Double-click a cell: cell border glows **Primary** (150ms transition) indicating edit mode
- Active edit cell: **Primary** border at full opacity, slight inner glow
- On blur / save: border fades back to **Neutral** with a brief **Success** flash confirming save

### Auto-Save Indicator

- Saving state: small spinner icon in **Primary** near the toolbar
- Saved state: checkmark icon morphs in with **Success** color (200ms), fades to **Neutral** after 2s
- Error state: **Error** icon with retry option

### Bulk Edit

- Selected rows: **Primary** wash at 15% opacity + left border
- Bulk edit toolbar slides down from top of grid (250ms ease-out)
- Toolbar background: one elevation step above grid, **Primary** top border accent
- "Apply" button: **Primary** filled / "Cancel": **Neutral** outlined

### Automation Status Badges

- `IN CICD`: **Success** badge (teal/green)
- `SCRIPTED`: **Info** badge (violet/purple)
- `OUT OF SYNC`: **Warning** badge (amber/golden)
- Not Automated: **Neutral** badge (slate)

### "Automation Only" Step Flag

- Small **Info** (violet/purple) chip next to the step number reading "Auto Only"
- Row background has a faint **Info** wash at 5% to visually distinguish from manual steps

### Autocomplete Dropdown

- Dropdown appears below the input (150ms fade-in)
- Matching text highlighted in **Primary** within each suggestion
- Selected suggestion: **Primary** background at 10% opacity
- Frosted glass backdrop effect on the dropdown panel
