# N7: User Management

**Priority:** Must Have (MVP)

## User Story

> As a QA Admin, I want team members to have individual accounts with appropriate permissions so that I can control access and track changes.

## Acceptance Criteria

### AC-1: User Invitation

- Given I am a QA Admin
- When I invite a team member
- Then they receive an email with registration link

### AC-2: Role Assignment

- Given a user has registered
- When I assign them a role (Admin, QA Engineer, SDET, Viewer)
- Then their permissions are enforced throughout the application

### AC-3: Viewer Read-Only Enforcement

- Given a user is a Viewer
- When they attempt to edit a test case
- Then the edit action is disabled and they see read-only view

## UI & Design Notes

> Reference: [design-system.md](../design-system.md)

### User Management Page

- User list displayed as a table/grid on a dark surface card
- Each row shows: avatar (Google profile pic), name, email, role badge, last active date

### Role Badges

| Role | Color | Style |
|---|---|---|
| Admin | **Error** (coral/red) | Filled badge — signals elevated privilege |
| QA Engineer | **Primary** (blue/indigo) | Filled badge |
| SDET | **Info** (violet/purple) | Filled badge |
| Viewer | **Neutral** (slate) | Outlined badge |

- Role badges appear next to user names throughout the app (comments, activity feed, assignee fields)
- Avatar ring color matches role color for quick visual identification

### Invite Flow

- "Invite User" button: **Primary** filled
- Invite modal: email input + role dropdown
- Role dropdown options show the color-coded badge preview next to each role name
- Sent invite: row appears in user list with **Warning** "Pending" badge until accepted

### Permission Enforcement (Viewer)

- Disabled edit controls: reduced opacity (40%) + cursor changes to `not-allowed`
- If a Viewer attempts an action (keyboard shortcut, etc.): **Info** toast — "View-only access. Contact an Admin for edit permissions."
- No destructive action buttons visible to Viewers at all
