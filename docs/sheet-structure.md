# Current Google Sheets Structure

> Based on screenshot analysis of actual test plan sheets.

## Sheet Layout

Each Google Sheets workbook represents a **project** (e.g., "Marketplace"). Within a workbook, each **sheet tab** represents a logical grouping of test cases (e.g., "Founder Registration", "Founder Login", "Account Registration", "Smoke Tests").

## Collapsible Test Case Groups

Test cases are organized as **collapsible row groups** within each sheet. Each group has:

### 1. Header Row (colored background)

| Field | Example |
|---|---|
| Test Case Name + ID | `Founder Login SL-1` |
| Manual Testing Status | `Manual Testing Complete` |
| Automation Status | `IN CICD` / `SCRIPTED` / `OUT OF SYNC` |
| Overall Status | `BLOCKED` (when applicable) |

### 2. Column Headers Row

Appears below each test case header:

| Column | Description |
|---|---|
| **ID** | Test case ID (e.g., `SL-1`) |
| **Description** | Full test case description / scenario narrative |
| **Precondition** | State required before test execution |
| **Test Step #** | Sequential step number (1, 2, 3…) |
| **Test Step Description** | What the user does in this step |
| **Test Data** | Specific data used (emails, passwords, URLs) |
| **Test Step Expected Result** | What should happen after the step |

### 3. Execution / Status Columns (right side)

| Column | Description |
|---|---|
| **Pass/Fail per platform** | Color-coded cells — green (Pass), red (Fail) — tracked per platform (Desktop, Tablet) |
| **Pass/Fail/Comment** | Combined status with notes |
| **Execution start date** | Date testing began |
| **Execution completion** | Date testing finished |
| **Added to code** | Whether automation code exists |
| **Comments** | Free-text notes (e.g., "Fail Desktop, Not Passing All Test States", "Sign in option doesn't show up…", "Logged back in after something") |
| **Bug report** | Links to GitLab issues (e.g., `https://gitlab.com/...`) |

## Test Step Rows

Each test step is its **own row** within the collapsible group:

```
SL-1 (header)
├── Step 1: User has received SL-1 secure login...
├── Step 2: User selects their previously registered email from 'Pick an account' page
├── Step 3: User enters password into the 'Password' field
├── Step 4: User selects the 'Sign in' button
├── Step 5: User closes and reopens session, begins at 'Login' page
├── Step 6: User selects email from 'Pick an account' page
├── Step 7: User enters password into the 'Password' field
├── Step 8: User clicks the 'Next' button
└── ...
```

Each step row has its own:
- Step number
- Step description
- Test data (e.g., `inbuyerportaltech@[domain]`, `SRFront12456`)
- Expected result
- Per-step pass/fail status (color-coded per platform)

## Automation Status Values

| Value | Meaning |
|---|---|
| `IN CICD` | Automated and running in CI/CD pipeline |
| `SCRIPTED` | Automation script exists but may not be in pipeline |
| `OUT OF SYNC` | Automation exists but is out of date with the manual test case |
| *(blank/none)* | Not automated / manual only |

## Key Observations for Data Model

1. **Test steps are separate rows**, not packed into a single cell — maps cleanly to a `test_steps` table
2. **Each test case is a collapsible group** with a header — maps to a `test_cases` table with child `test_steps`
3. **Pass/fail is tracked per step per platform** — needs a junction: `step_execution_results(step_id, platform, browser, status)`
4. **Automation status lives at the test case level**, not the step level
5. **Bug links are GitLab URLs** — currently free-text, should become structured references for S5
6. **Comments are free-text** at the test case level — will evolve into threaded comments (S7)
7. **Test data is per-step** — actual credentials/URLs used during that step
8. **"Automation Only"** label appears on some steps — modeled as a boolean flag on `test_steps`. These steps are skipped during manual test runs and only executed by automation. Visible in the grid as a badge/indicator so manual testers know to skip them.

## CSV Export Implications

When exported from Google Sheets, the structure will likely be:
- One row per test step (not per test case)
- Test case-level fields (ID, Description, Precondition) repeated or merged across step rows
- Header/grouping rows may appear as rows with partial data
- Column headers may vary slightly between sheets

The CSV import (N1) needs to handle:
- Detecting and collapsing repeated test case fields across step rows
- Ignoring or parsing group header rows
- Mapping the flat CSV rows back into the test_case → test_steps hierarchy
