---
name: Phase 3 Grid View
overview: Replace the hand-built MUI Table with MUI X Data Grid Pro as the primary test case interface (N6), adding suite grouping via tree data, column persistence, filtering, inline editing, bulk selection, and CSV export.
todos:
  - id: p3-license-api
    content: "3.1 -- MUI X license setup + new API routes: GET /api/projects/[projectId]/test-cases (all test cases for project with suite joins), GET+PUT /api/grid-preferences (column persistence), Zod schema for grid preferences"
    status: completed
  - id: p3-datagrid
    content: "3.2 -- TestCaseDataGrid component: DataGridPro with column definitions, custom cell renderers (AutomationBadge, PlatformChips, priority chips), tree data for suite grouping with colored headers, design system styling"
    status: completed
  - id: p3-column-persist
    content: "3.3 -- Column customization persistence: wire resize/reorder/visibility change events to debounced PUT /api/grid-preferences, restore from GET on mount"
    status: completed
  - id: p3-filters
    content: "3.4 -- GridFilterBar component: filter chips for automation_status, platform, priority, type, tags; translate to Data Grid filterModel; sorting enabled on all columns"
    status: completed
  - id: p3-editing-selection
    content: 3.5 -- Inline editing (title, automation_status, priority) with debounced auto-save + checkbox selection with BulkEditToolbar integration
    status: completed
  - id: p3-row-interactions
    content: 3.6 -- Row click opens TestCaseDrawer, suite group row click expands/collapses, proper event propagation handling
    status: completed
  - id: p3-csv-export
    content: 3.7 -- CSV export button using Data Grid Pro exportDataAsCsv(), success toast
    status: completed
  - id: p3-integration-verify
    content: 3.8 -- Integrate into suite page (replace TestCaseTable) and project page (add grid view toggle), RBAC enforcement for Viewer, npm run build verification
    status: completed
isProject: false
---

# Phase 3 -- Primary Interface (N6: Grid View)

## Context

Phase 3 has one MVP feature: **N6 Grid View**. The current suite page at `/projects/[projectId]/suites/[suiteId]/page.tsx` uses a hand-rolled MUI `Table` component ([src/components/test-cases/TestCaseTable.tsx](src/components/test-cases/TestCaseTable.tsx)) for test case listing. This phase replaces it with MUI X Data Grid Pro and adds a project-level grid view.

**Key constraint:** Row Grouping by column value is a **Premium** feature. Since the project has Data Grid **Pro** (not Premium), we will use **Tree Data** (a Pro feature) to model the natural suite-to-test-case hierarchy for collapsible suite groups.

**Existing assets to leverage:**

- [AutomationBadge.tsx](src/components/test-cases/AutomationBadge.tsx), [PlatformChips.tsx](src/components/test-cases/PlatformChips.tsx), [StatusBadge.tsx](src/components/execution/StatusBadge.tsx) -- reuse as custom cell renderers
- [BulkEditToolbar.tsx](src/components/test-cases/BulkEditToolbar.tsx) -- adapt to work with Data Grid's selection model
- [TestCaseDrawer.tsx](src/components/test-cases/TestCaseDrawer.tsx) -- opens on row click, unchanged
- `grid_column_preferences` table -- already exists with RLS (user can only access own prefs)
- [semanticColors.suiteColors](src/theme/palette.ts) -- for colored suite group headers

---

## 3.1 -- MUI X License + Project-Level Test Cases API

**MUI X License:**

- Add `NEXT_PUBLIC_MUI_X_LICENSE_KEY` to `.env.local` and `.env.example`
- Create `src/lib/mui-license.ts` that calls `LicenseInfo.setLicenseKey()` from `@mui/x-license`
- Import it in the root layout or ThemeRegistry so it runs once on app init

**New API route -- `GET /api/projects/[projectId]/test-cases`:**

- Returns all test cases for a project, joined with suite info (suite name, prefix, color_index)
- Ordered by suite position, then test case position
- Used by the new project-level grid view
- Uses existing `withAuth('read')` pattern from [src/lib/api/helpers.ts](src/lib/api/helpers.ts)

**Grid preferences API routes -- `/api/grid-preferences`:**

- `GET /api/grid-preferences?project_id=X&suite_id=Y` -- fetch column config for current user + project (+ optional suite)
- `PUT /api/grid-preferences` -- upsert column config. Body: `{ project_id, suite_id?, column_config }`. Sets `user_id` from auth. Uses `ON CONFLICT (user_id, project_id, suite_id) DO UPDATE`

**Zod schema:** `src/lib/validations/grid-preferences.ts` -- `upsertGridPreferencesSchema` (project_id: uuid, suite_id: uuid optional, column_config: object)

---

## 3.2 -- TestCaseDataGrid Component

Replace the current `TestCaseTable.tsx` with a new `TestCaseDataGrid.tsx` built on `DataGridPro`.

**File:** `src/components/test-cases/TestCaseDataGrid.tsx`

**Column definitions:**

- `__check`__ -- checkbox selection (hidden for Viewers)
- `display_id` -- monospace chip renderer
- `title` -- editable text cell
- `automation_status` -- `AutomationBadge` renderer, editable via singleSelect
- `platform_tags` -- `PlatformChips` renderer
- `priority` -- colored chip renderer, editable via singleSelect
- `type` -- text chip (functional/performance)
- `tags` -- comma-separated chips
- `updated_at` -- formatted date

**Tree Data for suite grouping (project-level view):**

- Use `treeData` prop with `getTreeDataPath` returning `[suiteName]` for suite rows and `[suiteName, displayId]` for test case rows
- Custom `groupingColDef` renders suite group rows with: colored left border (4px, `suiteColors[color_index]`), suite name in bold, prefix chip, test case count
- Expand/collapse with chevron rotation animation (250ms, per design spec)
- When viewing a single suite (suite page), tree data is disabled -- flat list

**Styling per [design-system.md](docs/design-system.md) and [n6-grid-view.md](docs/features/n6-grid-view.md):**

- Grid container: dark surface, 1px neutral border, 8px radius
- Row hover: primary wash 8% + faint primary left border (150ms)
- Selected row: primary wash 15% + solid primary left border
- Column headers: neutral background, bold white text
- Row dividers: neutral at 15% opacity

---

## 3.3 -- Column Customization + Persistence

Wire Data Grid Pro's built-in column features to the `grid_column_preferences` API:

- **Resize:** enabled via `resizable` column property. On `onColumnWidthChange`, debounce (500ms) and persist.
- **Reorder:** enabled via `disableColumnReorder: false`. On `onColumnOrderChange`, persist.
- **Show/hide:** column visibility panel via toolbar. On `onColumnVisibilityModelChange`, persist.
- **Restore on mount:** fetch preferences from `GET /api/grid-preferences`, apply as `initialState` for column dimensions, order, and visibility model.

Persistence payload shape (stored in `column_config` JSONB):

```json
{
  "columnOrder": ["display_id", "title", ...],
  "columnWidths": { "title": 300, "priority": 100 },
  "columnVisibility": { "tags": false, "type": false }
}
```

---

## 3.4 -- Filter Toolbar

**Component:** `src/components/test-cases/GridFilterBar.tsx`

A horizontal bar above the grid with filter chips:

- **Automation Status** -- multi-select: not_automated, scripted, in_cicd, out_of_sync
- **Platform** -- multi-select: desktop, tablet, mobile
- **Priority** -- multi-select: critical, high, medium, low
- **Type** -- single-select: functional, performance
- **Tags** -- text input with autocomplete from existing tags in the dataset

Active filters shown as filled chips with the semantic color of the filtered value (e.g., "IN CICD" gets a success-colored chip). Inactive filters are neutral outlined chips. "Clear All" text button at the end.

Filtering is applied **client-side** via Data Grid Pro's `filterModel` prop. The filter bar translates chip selections into Data Grid filter items.

**Sorting:** Enabled by default on all columns via Data Grid Pro. Multi-column sort supported. Active sort shows primary-colored arrow in header.

---

## 3.5 -- Inline Editing + Selection

**Inline editing:**

- Enable `editable: true` on title, automation_status, and priority columns
- Title: text input on double-click, with debounced auto-save (1s) via `PATCH /api/test-cases/[id]`
- Automation status: singleSelect cell editor with the 4 enum values
- Priority: singleSelect cell editor with the 4 enum values + "None"
- On `processRowUpdate` callback: call the PATCH API, flash row border success/error
- Disabled for Viewers (`isCellEditable` returns false when `!canWrite`)

**Selection + Bulk Edit:**

- Checkbox column via `checkboxSelection` prop (hidden for Viewers)
- On selection change, show [BulkEditToolbar.tsx](src/components/test-cases/BulkEditToolbar.tsx) above the grid
- Adapt BulkEditToolbar to receive selected IDs from Data Grid's `rowSelectionModel`
- After bulk apply, refresh data and clear selection

**Save status indicator:**

- Reuse the same save indicator pattern from the old table (saving spinner / saved checkmark / error icon)
- Show in the grid toolbar area

---

## 3.6 -- Row Interactions + Detail Drawer

- **Row click:** opens [TestCaseDrawer.tsx](src/components/test-cases/TestCaseDrawer.tsx) for the clicked test case (reuse existing, no changes needed)
- Click on checkbox or editable cell does NOT open the drawer (stop propagation)
- Suite group rows: click expands/collapses, does not open drawer

---

## 3.7 -- CSV Export

- Add an "Export CSV" button in the grid toolbar (primary outlined, download icon)
- Uses Data Grid Pro's built-in `GridToolbarExport` or custom `apiRef.current.exportDataAsCsv()` to export the current filtered/sorted view
- Success toast on download complete

---

## 3.8 -- Page Integration + Verification

**Suite page ([src/app/(dashboard)/projects/[projectId]/suites/[suiteId]/page.tsx](src/app/(dashboard)/projects/%5BprojectId%5D/suites/%5BsuiteId%5D/page.tsx)):**

- Replace `TestCaseTable` with `TestCaseDataGrid` in flat mode (no tree data, single suite)
- Keep the existing drawer, bulk edit, and create test case button integration

**Project page ([src/app/(dashboard)/projects/[projectId]/page.tsx](src/app/(dashboard)/projects/%5BprojectId%5D/page.tsx)):**

- Add a view toggle: "Suites" (current card list) vs "Grid" (all test cases in Data Grid with tree data grouping)
- Grid view fetches from `GET /api/projects/[projectId]/test-cases`
- Default to "Suites" view; user can toggle

**RBAC enforcement:**

- Viewer: no checkbox column, no editable cells, no bulk edit toolbar, no create button, export CSV still allowed
- All write operations checked server-side via existing `withAuth('write')`

**Final verification:**

- `npm run build` passes with zero errors and zero warnings
- Grid renders with correct suite grouping and colored headers
- Column resize/reorder/hide persists across page reloads
- Filters work across all key fields
- Inline editing saves correctly with auto-save indicator
- CSV export includes current filtered view
- Viewer role sees read-only grid

---

## New/Modified Files Summary

```
NEW:
  src/lib/mui-license.ts
  src/lib/validations/grid-preferences.ts
  src/app/api/projects/[projectId]/test-cases/route.ts
  src/app/api/grid-preferences/route.ts
  src/components/test-cases/TestCaseDataGrid.tsx
  src/components/test-cases/GridFilterBar.tsx
  src/components/test-cases/GridToolbar.tsx

MODIFIED:
  src/app/(dashboard)/projects/[projectId]/page.tsx           -- add grid view toggle
  src/app/(dashboard)/projects/[projectId]/suites/[suiteId]/page.tsx  -- swap Table for DataGrid
  src/components/providers/ThemeRegistry.tsx (or root layout)  -- import license setup
  src/theme/theme.ts                                           -- add DataGrid component overrides
  src/types/database.ts                                        -- add GridColumnPreferences if missing (already exists)
  .env.local / .env.example                                    -- add MUI X license key var

UNCHANGED (reused as-is):
  src/components/test-cases/AutomationBadge.tsx
  src/components/test-cases/PlatformChips.tsx
  src/components/test-cases/BulkEditToolbar.tsx
  src/components/test-cases/TestCaseDrawer.tsx
```

