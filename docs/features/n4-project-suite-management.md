# N4: Project and Suite Management

**Priority:** Must Have (MVP)

## User Story

> As a QA Engineer, I want to organize test cases into projects, features, and suites so that I maintain the same structure as my spreadsheets and generate meaningful test IDs.

## Acceptance Criteria

### AC-1: Project Creation

- Given I am creating a new project for the overall product (e.g., "Marketplace")
- When I create the project with the name "Marketplace"
- Then the system creates a project container that can hold multiple suites for that product

### AC-2: Suite Creation with Prefix

- Given I have created the "Marketplace" project
- When I create a suite within it for a grouping such as "Sponsor Registration" and set the suite key/prefix to "SR"
- Then test cases in that suite are organized under "Sponsor Registration" and use IDs starting with "SR"

### AC-3: Auto-Generated Test Case IDs

- Given I have a suite "Sponsor Registration" with prefix "SR"
- When I create the first test case in that suite
- Then the test case ID is automatically generated as "SR-1"

### AC-4: Sequential ID Assignment

- Given I have existing test cases SR-1 and SR-2 in the "Sponsor Registration" suite
- When I create another test case in the same suite
- Then the test case ID is automatically generated as "SR-3"

### AC-5: Suite-Based Organization View

- Given I have created multiple suites within the "Marketplace" project (e.g., "Sponsor Registration", "Investor Registration")
- When I view the project
- Then test cases are visually organized by suite, matching the logical groupings from my spreadsheets

### AC-6: Drag-and-Drop Reorganization

- Given I want to reorganize test cases between suites in the same project
- When I drag-and-drop a test case from one suite to another
- Then the test case moves to the new suite and maintains its existing ID and all associated history

## UI & Design Notes

> Reference: [design-system.md](../design-system.md)

### Project Dashboard

- Project cards on the main dashboard: dark surface with 1px **Neutral** border, rounded 8px
- Card hover: slight elevation lift + **Primary** border glow (150ms)
- Card shows project name, suite count, test case count, latest run pass rate
- Pass rate displayed as a small donut/ring chart using **Success** / **Error** / **Warning** fills

### Sidebar Navigation (Project → Suites)

- Project name at the top with a colored dot
- Suites listed below as a tree, each with a **suite-assigned accent color** dot/indicator
  - Suite colors cycle: Primary → Success → Info → Warning → Error
- Active suite: accent color left border + name highlighted in accent color
- Sidebar active indicator slides to selected item (200ms ease-out animation)

### Suite Header in Grid View

- Collapsible group header row: slightly lighter surface than grid rows
- Left border uses the **suite-assigned accent color** (4px solid)
- Suite prefix badge (e.g., "SR") in the suite's accent color as a chip
- Expand/collapse icon rotates smoothly (250ms)

### Drag-and-Drop

- Drag initiated: card lifts with increased shadow + slight scale-up
- Drop zone: target suite highlights with the target suite's accent color at 10% opacity + dashed border
- Successful drop: brief **Success** flash on the moved item
- Card follows cursor in real-time during drag

### Create Project / Suite Forms

- "New Project" button: **Primary** filled
- "New Suite" button: **Primary** outlined (secondary style, since it's contextual within a project)
- Suite prefix input: live preview of generated ID (e.g., typing "SR" shows "SR-1" preview in **Neutral** text)
