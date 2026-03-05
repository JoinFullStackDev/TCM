---
name: Phase 4 Import Reporting
overview: Build the CSV import wizard (N1) that parses real Google Sheets exports into the test case hierarchy, and the basic reporting dashboard (N5) with KPI cards, charts, and PDF/Excel export.
todos:
  - id: p4-csv-parser
    content: 4.1 -- CSV parser, row classifier, field parsers (platform results, automation status, suite detection, bug links, automation-only markers), Zod schemas for csv-import
    status: completed
  - id: p4-column-mapping
    content: 4.2 -- Column auto-detection logic + ColumnMapper UI component with confidence indicators and manual override dropdowns
    status: completed
  - id: p4-import-wizard
    content: 4.3 -- Import wizard page + 5 step components (FileUpload, ColumnMapper, Review with duplicate detection, ImportProgress, ImportComplete)
    status: completed
  - id: p4-import-api
    content: "4.4 -- Import API routes: POST /api/csv-import (process parsed data, create suites/cases/steps/links/results, track errors), GET /api/csv-import/[importId], GET errors"
    status: completed
  - id: p4-report-api
    content: "4.5 -- Reporting API: GET /api/reports/test-run/[runId] with aggregated KPIs, per-platform breakdown, status distribution"
    status: completed
  - id: p4-report-ui
    content: 4.6 -- Reports pages + chart components (KpiCards, PlatformBarChart, StatusDonutChart, ReportExport with PDF/Excel), install recharts + jspdf + xlsx
    status: completed
  - id: p4-navigation
    content: 4.7 -- Enable Reports sidebar nav, add Import CSV buttons to project/suite pages, update TopBar breadcrumbs
    status: completed
  - id: p4-verify
    content: 4.8 -- Import real _CSV-example.csv end-to-end, verify reports accuracy, RBAC enforcement, npm run build
    status: completed
isProject: false
---

# Phase 4 -- Data Migration and Reporting (N1 + N5)

## Context

Phase 4 covers two MVP features: **N1 (CSV Import)** and **N5 (Basic Reporting)**. The CSV import is the more complex of the two -- the real Google Sheets export (`docs/_CSV-example.csv`) has a non-trivial structure with interleaved header rows, repeating column headers, `**Automation Only`** marker rows, and multi-line fields. All target DB tables (`csv_imports`, `csv_import_errors`, `test_cases`, `test_steps`, `bug_links`, `execution_results`) already exist from the Phase 0 migration.

## CSV Structure Analysis

From `docs/_CSV-example.csv`, each test case follows this pattern:

```
ROW TYPE 1 -- Test Case Header:
  "Sponsor Registration SR-1,,Manual Testing Complete,,IN CICD,,,"Execution start date: ..."
  → Contains: suite-name + display_id, automation_status, execution dates

ROW TYPE 2 -- Column Headers (repeats per test case):
  "Id,Description,Precondition,Test Step #,Test Step Description,..."

ROW TYPE 3 -- **Automation Only** marker (optional):
  ",,,**Automation Only**,User has completed SR-1 test user: ####,,..."
  → Becomes a step with is_automation_only = true

ROW TYPE 4 -- First step row (has ID + description + precondition):
  "SR-1,\"Description...\",Precondition,1,\"Step desc\",\"Test data\",\"Expected result\",\"Pass...\",IN CICD,comment,buglink,status"

ROW TYPE 5 -- Subsequent step rows (empty ID/desc/precondition):
  ",,,2,\"Step desc\",\"Test data\",\"Expected result\",\"Pass Desktop, Pass Mobile\",,..."
```

Key parsing challenges:

- **Suite detection:** The header row format is `"{SuiteName} {DisplayId}"` -- split on last space to get suite name and ID prefix
- **Platform results:** Values like `"Pass Tablet, Pass Desktop, Fail Mobile"` must be split into per-platform execution results
- **Automation status mapping:** `IN CICD` -> `in_cicd`, `SCRIPTED` -> `scripted`, `OUT OF SYNC` -> `out_of_sync`, `BLOCKED` -> stored as execution status
- `****Automation Only`**** in the "Test Step #" column -> step with `is_automation_only = true`
- **Duplicate column headers** appear between every test case and must be skipped
- **Multi-line fields** in descriptions and test data (CSV-standard quoting)
- **Bug links** are GitLab URLs in the "Bug report" column

---

## 4.1 -- Zod Schemas + CSV Parser

**New validation schemas** (`src/lib/validations/csv-import.ts`):

- `createImportSchema` -- project_id, suite_id (optional), file_name, file_size
- `updateImportSchema` -- status, imported_count, skipped_count, error_count, column_mappings
- `columnMappingSchema` -- maps CSV column indices to system fields

**CSV Parser** (`src/lib/csv/parser.ts`):

- Client-side CSV parsing using a lightweight approach (no heavy library needed -- use the browser's built-in text processing or a minimal parser for quoted fields / multi-line values)
- `parseCSV(text: string)` returns raw rows as string arrays
- Handles: quoted fields with commas, escaped quotes (`""`), multi-line values inside quotes

**Row Classifier** (`src/lib/csv/classifier.ts`):

- `classifyRow(row)` returns: `'header' | 'column_header' | 'automation_only' | 'first_step' | 'step' | 'empty'`
- Header detection: first cell matches pattern `{words} {PREFIX}-{number}` (e.g., `"Sponsor Registration SR-1"`)
- Column header detection: first cell is `"Id"` or `" "` and second is `"Description"`
- Automation only: "Test Step #" column contains `**Automation Only`**

**Field Parsers** (`src/lib/csv/field-parsers.ts`):

- `parsePlatformResults(value: string)` -- splits `"Pass Tablet, Pass Desktop, Fail Mobile"` into `[{ platform: 'tablet', status: 'pass' }, ...]`
- `parseAutomationStatus(value: string)` -- maps `"IN CICD"` -> `"in_cicd"`, etc.
- `parseSuiteFromHeader(headerText: string)` -- extracts suite name and display_id from header row
- `parseBugLinks(value: string)` -- extracts URLs from the bug report column
- `parseExecutionDates(value: string)` -- extracts start/completion dates from multiline header cell

---

## 4.2 -- Column Mapping + Auto-Detection

**Auto-detect logic** (`src/lib/csv/column-mapper.ts`):

- Given the column header row (row type 2), fuzzy-match each header to system fields:
  - `"Id"` -> display_id
  - `"Description"` -> description
  - `"Precondition"` -> precondition
  - `"Test Step #"` -> step_number
  - `"Test Step Description"` -> step_description
  - `"Test Data"` -> test_data
  - `"Test Step Expected Result"` -> expected_result
  - `"Pass/Fail/Comments if Fail"` -> platform_results
  - `"Added to code"` -> automation_status_cell
  - `"Comments"` -> comments
  - `"Bug report"` -> bug_link
- Return a mapping object: `{ [csvColumnIndex]: systemFieldName }`
- Confidence score per mapping (exact match = high, fuzzy = medium, unmapped = needs review)

**UI component** (`src/components/csv-import/ColumnMapper.tsx`):

- Two-column layout: CSV column name on left, system field dropdown on right
- Auto-mapped columns: success left border + checkmark
- Unmapped / needs-review: warning left border + attention icon
- User can override any mapping via dropdown

---

## 4.3 -- Import Wizard UI

**Page:** `src/app/(dashboard)/projects/[projectId]/import/page.tsx`

5-step wizard using MUI Stepper:

1. **Upload** -- drag-and-drop zone + file picker. Validates `.csv` extension and max 10MB. Parses file client-side immediately.
2. **Column Mapping** -- shows auto-detected mappings with override dropdowns. "Confirm Mapping" button.
3. **Review** -- preview table showing first 10-20 parsed test cases with steps nested. Highlights any rows that will error. Shows total counts. Duplicate detection: if display_ids already exist in the target suite, flag them with "Update Existing" / "Skip" options.
4. **Import** -- progress bar with live counter. Calls `POST /api/csv-import` which processes rows server-side. Shows real-time status updates.
5. **Done** -- summary: X imported, Y skipped, Z errors. Link to error details. Link to view imported test cases.

**Supporting components:**

- `src/components/csv-import/ImportWizard.tsx` -- stepper + step routing
- `src/components/csv-import/FileUploadStep.tsx` -- drag-and-drop zone
- `src/components/csv-import/ColumnMapper.tsx` -- mapping UI (from 4.2)
- `src/components/csv-import/ReviewStep.tsx` -- preview table with duplicate flags
- `src/components/csv-import/ImportProgressStep.tsx` -- progress bar + counters
- `src/components/csv-import/ImportCompleteStep.tsx` -- summary + links

---

## 4.4 -- Import API Routes

`**POST /api/csv-import`** (`src/app/api/csv-import/route.ts`):

- Requires `write` permission
- Accepts JSON body with: `project_id`, `suite_id` (optional -- auto-detect or create suites), `column_mappings`, `parsed_data` (the fully parsed test case hierarchy from the client), `duplicate_strategy` (`"skip"` or `"update"`)
- Processing logic:
  1. Create a `csv_imports` row with status `processing`
  2. For each test case in parsed_data:
    - If suite doesn't exist, create it (auto-assign prefix from the display_id pattern)
    - Check for duplicate display_id -- skip or update based on strategy
    - Insert/update `test_cases` via `generate_test_case_id` RPC (for new) or direct update (for existing)
    - Insert `test_steps` for each step, set `is_automation_only` where flagged
    - Insert `bug_links` from parsed URLs
    - Insert `execution_results` from parsed platform statuses (if a test run is created/targeted)
  3. Track errors per row in `csv_import_errors`
  4. Update `csv_imports` with final counts and status `completed` or `failed`
- Returns the import ID for status polling

`**GET /api/csv-import/[importId]`** (`src/app/api/csv-import/[importId]/route.ts`):

- Returns import status, counts, and associated errors
- Used for polling during import and for the completion screen

`**GET /api/csv-import/[importId]/errors`**:

- Returns paginated list of `csv_import_errors` for the import

**Zod validation for the import payload** in `src/lib/validations/csv-import.ts`.

---

## 4.5 -- Reporting API

`**GET /api/reports/test-run/[runId]`** (`src/app/api/reports/test-run/[runId]/route.ts`):

- Requires `read` permission
- Aggregates from `execution_results` + `test_run_cases` for the given run:
  - Total cases, pass/fail/blocked/skip/not_run counts
  - Pass rate percentage
  - Per-platform breakdown (group by `platform`, count statuses)
  - Status distribution (for donut chart)
- Returns a structured report object

---

## 4.6 -- Reports Page + Charts

**Page:** `src/app/(dashboard)/reports/page.tsx` -- report selection/listing

**Page:** `src/app/(dashboard)/reports/[runId]/page.tsx` -- report for a specific test run

**Components:**

- `src/components/reports/KpiCards.tsx` -- row of 5 cards (total, pass, fail, blocked, pass rate) with colored left borders per [n5-basic-reporting.md](docs/features/n5-basic-reporting.md). Staggered fade-up animation on load (50ms per card).
- `src/components/reports/PlatformBarChart.tsx` -- bar chart comparing pass rates per platform. Desktop=primary, Tablet=info, Mobile=success. Uses a lightweight SVG-based approach (no heavy charting library -- custom SVG bars with Framer Motion animation, or consider [recharts](https://recharts.org) if preferred for maintainability). Bars animate in with 50ms stagger.
- `src/components/reports/StatusDonutChart.tsx` -- donut/ring chart with pass=success, fail=error, blocked=warning, skip/not_run=neutral segments. Center label shows pass rate percentage. Clockwise wipe animation (400ms).
- `src/components/reports/ReportExport.tsx` -- "Export to PDF" and "Export to Excel" buttons. PDF: use `html2canvas` + `jspdf` (or a simpler approach). Excel: use `xlsx` (SheetJS) library.

---

## 4.7 -- Sidebar + Navigation Updates

- Enable the "Reports" nav item in [src/components/layout/Sidebar.tsx](src/components/layout/Sidebar.tsx) -- link to `/reports`
- Add "Import CSV" button to the project detail page and/or suite page header (visible only for `write` users), linking to `/projects/[projectId]/import`
- TopBar breadcrumbs: add routes for `/projects/[id]/import` and `/reports/[runId]`

---

## 4.8 -- Verification

- Import the real `docs/_CSV-example.csv` successfully:
  - Suites auto-detected (SR, SL, SAC, SEO, etc.)
  - Steps parsed with correct step numbers
  - `**Automation Only`** steps flagged as `is_automation_only = true`
  - Platform results split correctly (Pass Desktop, Fail Tablet, etc.)
  - Automation statuses mapped (IN CICD, SCRIPTED, OUT OF SYNC, BLOCKED)
  - Bug links extracted as structured URLs
  - Duplicates handled per user choice
- Error reporting: rows with issues logged to `csv_import_errors`
- Reports: KPIs match actual execution data, charts render correctly
- Export: PDF and Excel files download and are valid
- Viewer: read-only on reports (can view and export), no access to import
- `npm run build` passes with zero errors and zero warnings

---

## New Dependencies

- **Charts:** `recharts` (lightweight, React-native, works well with dark themes and custom colors)
- **PDF export:** `jspdf` + `html2canvas`
- **Excel export:** `xlsx` (SheetJS community edition)

---

## New/Modified Files Summary

```
NEW:
  src/lib/csv/parser.ts
  src/lib/csv/classifier.ts
  src/lib/csv/field-parsers.ts
  src/lib/csv/column-mapper.ts
  src/lib/validations/csv-import.ts
  src/app/api/csv-import/route.ts
  src/app/api/csv-import/[importId]/route.ts
  src/app/api/csv-import/[importId]/errors/route.ts
  src/app/api/reports/test-run/[runId]/route.ts
  src/app/(dashboard)/projects/[projectId]/import/page.tsx
  src/app/(dashboard)/reports/page.tsx
  src/app/(dashboard)/reports/[runId]/page.tsx
  src/components/csv-import/ImportWizard.tsx
  src/components/csv-import/FileUploadStep.tsx
  src/components/csv-import/ColumnMapper.tsx
  src/components/csv-import/ReviewStep.tsx
  src/components/csv-import/ImportProgressStep.tsx
  src/components/csv-import/ImportCompleteStep.tsx
  src/components/reports/KpiCards.tsx
  src/components/reports/PlatformBarChart.tsx
  src/components/reports/StatusDonutChart.tsx
  src/components/reports/ReportExport.tsx

MODIFIED:
  src/components/layout/Sidebar.tsx           -- enable Reports nav, add Import entry
  src/app/(dashboard)/projects/[projectId]/page.tsx -- add Import CSV button
  src/app/(dashboard)/projects/[projectId]/suites/[suiteId]/page.tsx -- add Import CSV button
  src/components/layout/TopBar.tsx            -- breadcrumbs for import + reports routes
```

