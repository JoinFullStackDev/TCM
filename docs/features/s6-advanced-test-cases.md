# S6: Advanced Test Case Features

**Priority:** SOON (post-MVP)

## User Story

> As a QA engineer, I want to use test case templates and define dependencies so that I can work more efficiently.

## Acceptance Criteria

### AC-1: Test Case Templates

- Given I have a common test flow (e.g., "Login Flow")
- When I save it as a template
- Then I can create new test cases from the template with predefined steps

### AC-2: Test Case Dependencies

- Given test SR-2 depends on SR-1 completing successfully
- When I add a dependency link
- Then the system shows the dependency in the test case view and warns if SR-1 hasn't passed

### AC-3: Custom Fields

- Given I want to add a project-specific field (e.g., "Regulation Type")
- When I create a custom field
- Then the field appears in test case forms and I can filter/report by it

## Relationship to MVP

- **Templates:** Test case creation (N2) should use a structure that can serve as a template source later.
- **Dependencies:** The data model should allow inter-case references.
- **Custom fields:** Consider a JSONB metadata column or a separate custom_fields table from the start.
