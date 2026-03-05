---
name: Suite Group Hierarchy
overview: Add a `group` field to suites so they can be visually grouped by persona/category (e.g. "Sponsor", "Investor") in the sidebar, suite list, and create/edit dialogs.
todos:
  - id: grp-1
    content: "Add group field: migration SQL, types, validation"
    status: completed
  - id: grp-2
    content: "Suite create/edit dialogs: group field with autocomplete from existing groups"
    status: completed
  - id: grp-3
    content: "Sidebar: render suites grouped by group field with collapsible sections"
    status: completed
  - id: grp-4
    content: "SuiteList: render grouped sections with headers on project page"
    status: completed
  - id: grp-5
    content: "Project page: add group filter chips above suite list"
    status: completed
isProject: false
---

# Suite Group Hierarchy

Add a `group` string field to suites that enables visual grouping in the sidebar and suite list by persona or category (e.g. "Sponsor", "Investor").

---

## What changes

### 1. Database: Add `group` column to suites

Migration SQL to run in Supabase SQL Editor:

```sql
ALTER TABLE suites ADD COLUMN "group" text;
CREATE INDEX idx_suites_group ON suites("group");
```

Also update [supabase/migrations/00001_initial_schema.sql](supabase/migrations/00001_initial_schema.sql) for documentation (add `"group" text` to the `CREATE TABLE suites` block).

Update the `Suite` interface in [src/types/database.ts](src/types/database.ts) to add `group: string | null`.

### 2. Validation and API

- Add `group: z.string().trim().max(50).nullable().optional()` to both `createSuiteSchema` and `updateSuiteSchema` in [src/lib/validations/suite.ts](src/lib/validations/suite.ts)
- The existing suite API routes already forward validated fields to Supabase, so no route changes needed

### 3. Create/Edit Suite Dialogs

In both [src/components/suites/CreateSuiteDialog.tsx](src/components/suites/CreateSuiteDialog.tsx) and [src/components/suites/EditSuiteDialog.tsx](src/components/suites/EditSuiteDialog.tsx):

- Add a `group` text field with autocomplete from existing group names in the project
- Fetch existing groups via the suites already loaded (extract unique `group` values)
- Use MUI `Autocomplete` with `freeSolo` so users can type a new group name or pick an existing one
- Place it above the description field

### 4. Sidebar: Grouped suites with collapsible sections

Refactor the suite list in [src/components/layout/Sidebar.tsx](src/components/layout/Sidebar.tsx) (lines 208-276):

- Group `suites` by their `group` field (null/empty group goes into an "Ungrouped" section at the bottom)
- Each group renders as a collapsible section with a header showing the group name
- Suites within each group keep their current rendering (color dot, name, prefix chip)
- Groups default to expanded; clicking the group header toggles collapse
- Persist collapsed state in component state (not DB)

Sidebar visual structure:

```
Projects
  ▼ Sponsor
      Sponsor Registration (SR)
      Sponsor Login (SL)
      Sponsor Account Creation (SAC)
      Sponsor Equity Offering (SEO)
      ...
  ▼ Investor
      Investor Registration (IR)
      Investor Login (IL)
      Investor Account Creation (IAC)
      ...
  ▼ Ungrouped
      ...
```

### 5. Suite List (project page): Grouped sections

Refactor [src/components/suites/SuiteList.tsx](src/components/suites/SuiteList.tsx):

- Group suites by `group` field
- Render each group as a section with a header (group name, suite count)
- Drag-and-drop reordering works within a group (suites can be reordered within their group)
- Suites with no group appear in an "Other" section at the bottom

### 6. Suite list filter bar on project page

In [src/app/(dashboard)/projects/[projectId]/page.tsx](src/app/(dashboard)/projects/[projectId]/page.tsx):

- Add filter chips above the suite list for each unique group name
- Clicking a group chip filters the suite list to only that group
- "All" chip shows everything (default)
