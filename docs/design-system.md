# Design System & UI Guidelines

## Theme

- **Mode:** Dark mode only (no light mode toggle needed)
- **Background:** Super dark gray (not pure black — e.g., `#0A0A0F` or `#111118` range, with surface layers slightly lighter for elevation)
- **Aesthetic:** Vibrant, polished, professional — not playful or childish. Think modern dev tooling meets enterprise dashboard.

## Accent Color Palette

A **multi-accent theme** using a cohesive set of colors that each serve a distinct semantic purpose. The colors should feel like they belong together — similar saturation/brightness levels, working harmoniously on the dark background.

| Role | Color Intent | Usage |
|---|---|---|
| **Primary** | Electric blue / indigo | Navigation highlights, primary buttons, active states, selected rows |
| **Success** | Vivid teal / green | Pass status, successful operations, positive metrics |
| **Error** | Warm coral / red | Fail status, errors, destructive actions, critical alerts |
| **Warning** | Amber / golden | Blocked status, warnings, thresholds approaching |
| **Info** | Soft violet / purple | Informational badges, automation status indicators, links |
| **Neutral accent** | Cool slate / muted blue-gray | Borders, dividers, secondary text, inactive states |

### Color Mapping — Statuses

| Element | Value | Color Role |
|---|---|---|
| Execution Status | Pass | **Success** (teal/green) |
| Execution Status | Fail | **Error** (coral/red) |
| Execution Status | Blocked | **Warning** (amber/golden) |
| Execution Status | Skip | **Neutral** (slate) |
| Execution Status | Not Run | **Neutral** (lighter variant) |
| Automation Status | `IN CICD` | **Success** (teal/green) — actively in pipeline |
| Automation Status | `SCRIPTED` | **Info** (violet/purple) — script exists, not in CI |
| Automation Status | `OUT OF SYNC` | **Warning** (amber/golden) — needs attention |
| Automation Status | Not Automated | **Neutral** (slate) |
| Step Flag | Automation Only | **Info** (violet/purple) chip/badge |

### Color Mapping — Platforms

| Platform | Color Role | Notes |
|---|---|---|
| Desktop | **Primary** (blue/indigo) | Column tint in execution matrix, badge color |
| Tablet | **Info** (violet/purple) | Column tint in execution matrix, badge color |
| Mobile (future) | **Success** (teal/green) | Reserved for post-MVP |

### Color Mapping — Roles

| Role | Color Role | Used in |
|---|---|---|
| Admin | **Error** (coral/red) | Role badge, avatar ring — signals elevated privilege |
| QA Engineer | **Primary** (blue/indigo) | Role badge, avatar ring |
| SDET | **Info** (violet/purple) | Role badge, avatar ring |
| Viewer | **Neutral** (slate) | Role badge, avatar ring |

### Color Mapping — Suites

Each suite within a project is assigned an accent color from the palette on creation. The color is used for:

- Left-border indicator on collapsible test case groups in the grid
- Suite chip/badge in navigation and breadcrumbs
- Sidebar tree item dot/indicator

The system cycles through the accent palette: Primary → Success → Info → Warning → Error → then repeats. This keeps suites visually distinct within a project while staying within the cohesive palette.

### Color Mapping — Interactive Elements

| Element | State | Color Role |
|---|---|---|
| Primary button | Default | **Primary** filled, white text |
| Primary button | Hover | **Primary** with glow shadow |
| Secondary button | Default | **Primary** outlined, accent text |
| Destructive button | Default | **Error** filled, white text |
| Link text | Default | **Info** (violet/purple) |
| Selected row | Active | **Primary** at 15% opacity wash |
| Hovered row | Hover | **Primary** at 8% opacity wash |
| Filter chip (active) | Active | Matches the semantic color of the value being filtered |
| Toast — success | Visible | **Success** left border + icon |
| Toast — error | Visible | **Error** left border + icon |
| Toast — warning | Visible | **Warning** left border + icon |
| Toast — info | Visible | **Info** left border + icon |
| Progress bar | Active | **Primary** → **Success** gradient (fills left to right) |
| Skeleton loader | Loading | **Neutral** shimmer sweep |

### Color Cohesion Rules

- All accent colors should share a similar **saturation band** (~70–85%) so nothing looks out of place
- **Brightness** should be tuned for strong contrast against the dark background without being neon/glaring
- Accent colors appear in **chips, status badges, chart segments, progress bars, sidebar highlights, and icon tints** — tying the palette together across every surface
- Avoid using raw accent colors on large surfaces; use them at **reduced opacity (10–15%)** for backgrounds (e.g., a faint teal wash behind a "Pass" row) to create depth without overwhelming
- **Gradients** are acceptable for hero elements, chart fills, and progress indicators — subtle linear gradients between two adjacent palette colors (e.g., primary → info for a shimmer effect)

## Contrast & Readability

- Primary text: white or near-white (`#E8E8ED` range) on dark background
- Secondary text: medium gray (`#8888A0` range) — still clearly readable
- All interactive elements must meet **WCAG AA contrast ratio** (4.5:1 for text, 3:1 for large text/icons)
- Status colors (pass/fail/blocked) should be immediately distinguishable at a glance in the grid

## Animations & Motion

### Principles

- Motion should feel **purposeful and informative**, not decorative
- Every animation communicates something: a state change, a spatial relationship, or a transition between views
- Keep durations **snappy** — 150–300ms for micro-interactions, 300–500ms for page/panel transitions
- Use **easing curves** that feel natural: ease-out for entrances, ease-in for exits, ease-in-out for morphs

### Where to Use Animation

| Context | Animation | Duration |
|---|---|---|
| **Page transitions** | Subtle fade + slide (content slides up ~8px as it fades in) | 300ms |
| **Grid row expansion** (collapsible test cases) | Smooth height expansion with content fade-in | 250ms |
| **Status changes** (Pass/Fail/Blocked) | Color morph with a brief pulse/glow on the badge | 200ms |
| **Sidebar navigation** | Active indicator slides to the selected item | 200ms ease-out |
| **Modals / drawers** | Scale from 95% → 100% with fade | 250ms |
| **Toast notifications** | Slide in from top-right, auto-dismiss with fade | 300ms in, 200ms out |
| **Data loading** | Skeleton shimmer with subtle gradient sweep | Continuous until loaded |
| **Hover states** | Slight elevation lift + accent border glow | 150ms |
| **Bulk select** | Checkbox ripple + row highlight sweep | 150ms |
| **Chart rendering** | Bars/segments animate in sequentially (stagger 50ms each) | 400ms total |
| **Drag-and-drop** (test case reorder) | Lifted card shadow + placeholder ghost | Real-time |

### What to Avoid

- Bounce effects or overshoot easing (feels playful/childish)
- Animations longer than 500ms for in-page interactions
- Motion on every scroll event (performance concern + distracting)
- Parallax or 3D transforms (unnecessary complexity)

## Component Styling Notes

### Grid (N6)

- Row hover: faint accent wash (`primary` at 8% opacity) + subtle left border highlight
- Selected rows: stronger accent wash (`primary` at 15%) + persistent left border
- Collapsible groups: header row uses a slightly lighter surface with accent left border indicating suite color
- Status cells: filled badge with rounded corners, accent color background at ~20% with full-color text

### Cards & Panels

- Surface elevation via progressively lighter grays (not shadows on dark backgrounds — shadows disappear on dark)
- Thin 1px borders in `neutral accent` color for definition
- Rounded corners (8px for cards, 4px for inputs/badges)

### Buttons

- Primary: filled with `primary` accent, white text
- Secondary: outlined with `primary` accent border, accent text
- Destructive: filled with `error` accent
- All buttons: subtle hover glow (box-shadow with accent color at low opacity)

### Charts (N5 Reporting)

- Use the full accent palette for chart segments — each series gets its own accent color
- Dark grid lines (`neutral accent` at 30%) on the chart background
- Tooltip on hover with a frosted glass effect (backdrop-blur + dark translucent background)
