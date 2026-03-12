# Docs-First Kickoff Blueprint

> Paste the prompt block below into Lovable first. This file is designed to be a single, reusable blueprint for planning any project before code.

## Lovable Bootstrap Prompt (Paste First)

```text
You are my Docs-First Project Assistant.

Your first task is to create a `docs/` folder and scaffold these files exactly:
- docs/overview.md
- docs/tech-stack.md
- docs/design-system.md
- docs/user-personas.md
- docs/mvp-requirements.md
- docs/future-requirements.md
- docs/schema.md
- docs/roadmap.md
- docs/features/ (folder for feature docs, e.g. n1-*.md, n2-*.md, s1-*.md)

Operating rules (must follow):
1) Docs-first: do not generate implementation code until the required docs exist.
2) Source of truth: treat `docs/` as canonical context for all future output.
3) Anti-hallucination: if a detail is missing from `docs/`, ask a clarifying question or mark it as "TBD"; never invent.
4) Consistency: keep feature names, IDs, entities, and role permissions consistent across all docs.
5) Security by default: explicitly document auth, authorization, data validation, and access control policies.
6) Change control: when requirements change, update the relevant docs first, then use updated docs as reference for follow-up work.

When done, return:
- A checklist of created docs files
- A short list of missing inputs needed from me
- A proposed order for filling docs before coding
```

---

## 1) Project Snapshot

**Project Name:**  
**Owner:**  
**Team:**  
**Last Updated:**  

### One-Sentence Mission
Describe what this product does and for whom.

### Problem Statement
- Current pain:
- Why this matters now:
- Desired outcome in 90 days:

---

## 2) Scope and Goals

### In Scope (MVP)
- Core capability 1
- Core capability 2
- Core capability 3

### Out of Scope (Now)
- Explicit non-goal 1
- Explicit non-goal 2

### Success Metrics
- Adoption:
- Quality:
- Delivery:
- Business impact:

---

## 3) Users, Roles, and Permissions

### Primary User Types
- **Role A:** responsibilities and key workflow
- **Role B:** responsibilities and key workflow
- **Role C:** responsibilities and key workflow

### Permission Matrix

| Action | Role A | Role B | Role C |
|---|---|---|---|
| View data | ✅ | ✅ | ✅ |
| Create/Edit | ✅ | ✅ | ❌ |
| Delete | ✅ | ❌ | ❌ |
| Manage users/settings | ✅ | ❌ | ❌ |

**Rule:** enforce permissions at both app and backend/database layers.

---

## 4) MVP Feature Requirements

### F1 - Feature Name
**Outcome:**  
**Acceptance Criteria:**
- [ ] AC1
- [ ] AC2
- [ ] AC3

### F2 - Feature Name
**Outcome:**  
**Acceptance Criteria:**
- [ ] AC1
- [ ] AC2

### F3 - Feature Name
**Outcome:**  
**Acceptance Criteria:**
- [ ] AC1
- [ ] AC2

---

## 5) UX and Design Guardrails

### Experience Principles
- Clear and fast over clever
- Consistent interaction patterns
- Accessible by default

### Design System Basics
- Theme mode:
- Color roles:
- Component library:
- Interaction and motion guidelines:

### Accessibility
- Contrast target (WCAG):
- Keyboard navigation:
- Screen reader considerations:

---

## 6) Technical Architecture

### Stack Decisions
- **Frontend:**
- **Backend/API:**
- **Database:**
- **Auth:**
- **Storage:**
- **Hosting/Deploy:**

### Why This Stack
- Decision rationale 1
- Decision rationale 2

### Non-Functional Requirements
- Performance target:
- Reliability target:
- Security baseline:
- Expected scale:

---

## 7) Data Model (High-Level)

### Core Entities and Relationships
List key entities and how they relate.

Example:
- `Project` has many `Suites`
- `Suite` has many `TestCases`
- `TestCase` has many `Steps`

### Data Rules
- ID strategy:
- Audit fields:
- Soft vs hard delete:
- Indexing priorities:

---

## 8) Security and Compliance

### Authentication
- Sign-in method:
- Session/token handling:

### Authorization
- Role model:
- Enforcement points:

### Data Protection
- Input validation:
- File upload restrictions:
- Secret management:
- Rate limiting:

---

## 9) API and Integrations

### API Conventions
- API style (REST/RPC/GraphQL):
- Validation standard:
- Error response format:

### MVP Endpoints
- `GET /...`
- `POST /...`
- `PATCH /...`

### External Integrations
- Integration:
- Purpose:
- Auth method:
- Retry/failure behavior:

---

## 10) Delivery Roadmap

### Suggested Phases
- **Phase 0:** foundation
- **Phase 1:** core data and CRUD
- **Phase 2:** workflows and execution
- **Phase 3:** reporting and integrations

### Phase Exit Criteria
- [ ] Feature acceptance criteria met
- [ ] Permission checks validated
- [ ] Tests passing
- [ ] Build passes with no errors/warnings
- [ ] Docs updated

---

## 11) Testing Strategy

### Required Coverage
- Unit tests for core logic
- Integration tests for API + data rules
- E2E tests for critical user journeys
- Role-permission tests

### Quality Gates
- `npm run lint` passes
- `npm run test` passes
- `npm run build` passes with no errors/warnings

---

## 12) Risks, Assumptions, and Deferred Decisions

### Top Risks
- Risk 1 -> mitigation
- Risk 2 -> mitigation

### Assumptions
- Assumption 1
- Assumption 2

### Deferred Decisions
Track open decisions explicitly as `TBD` with owner and target date.

---

## 13) Definition of Ready (Before Coding)

Code starts only when all are true:

- [ ] Required `docs/` structure exists
- [ ] MVP scope is approved
- [ ] Features include acceptance criteria
- [ ] Roles/permissions are fully defined
- [ ] Data model and security rules are documented
- [ ] Roadmap phases and quality gates are approved
- [ ] Open decisions are visible and tracked

---

## 14) Changelog

| Date | Author | Change |
|---|---|---|
| YYYY-MM-DD | Name | Initial draft |

