# PRD — MCP Epic 1: Test Case CRUD

**Status:** Draft
**Epic:** Test Case CRUD (MCP tool surface)
**Scope:** This epic only. Not the full MCP server, not other epics.
**Author:** _TBD_
**Last updated:** 2026-07-30

---

## 1. Problem Statement

AI agents (Torque, triage-e2e, and general-purpose **Claude agents**) need to read and write test cases in TCM (TestForge Case Manager). Today they do this by issuing **raw Supabase REST calls** against the underlying Postgres schema. That approach is fragile and unsafe:

- Agents must know internal table names, column names, enum values, and the `suite → project` join topology. A schema change breaks every agent.
- Agents must resolve `display_id` (e.g. `APA-3`) to internal UUIDs themselves — but **there is no lookup endpoint for this today** (verified: all TCM REST routes key on the UUID `id`; `display_id` is only used for generation and search). Agents currently improvise this resolution.
- Raw REST calls bypass TCM's validation layer (Zod schemas), its `display_id` generation RPC, its `in_cicd` display-id lock, and its soft-delete scoping conventions. An agent can write malformed or unsafe data directly.
- Writes happen with **no human checkpoint**. An agent can create or overwrite test cases with no review.

We want to replace raw REST access with a small set of **MCP tools** that expose test cases through a clean, schema-stable contract. Agents reference cases by `display_id` and never see UUIDs. Every write goes through a **dry-run → human approval → commit** flow: the dry-run **returns a summary to the calling agent**, and the agent presents it to a human wherever the human already is — **Slack** (Torque hands it to Clutch, which posts) or the **LLM chat itself** (Claude Code renders it inline). The MCP server itself never posts anywhere.

## 2. Goals

- **G1** — Give agents a stable, schema-agnostic tool contract for the full test-case lifecycle: resolve → list → read → create → update.
- **G2** — Agents reference test cases exclusively by `display_id`. The MCP server resolves `display_id ↔ UUID` transparently. Agents never construct, pass, or receive internal UUIDs for a test case.
- **G3** — No test case is created or mutated without an explicit human go-ahead. Every write tool supports `dry_run`, which **returns** a diff-style summary to the calling agent (instead of writing). The agent presents it for approval — Torque via Clutch→Slack, Claude Code inline in chat. The MCP server does not deliver the summary itself.
- **G4** — Tool inputs are validated against TCM's real schema (enums, required fields, step shape) before any write, so agents cannot produce invalid data.
- **G5** — Tools return exactly what agents need to act, no more. List/search returns a lightweight projection; `get` returns full detail including steps.

### Non-Goals (this epic)

Explicitly listed in **Section 4 — Out of Scope**.

## 3. Success Metrics

The four signals below are the axes of "did MCP help." **None is measurable without instrumentation** — see **§12 (Appendix C)** for how each is measured, the baseline required, and the `mcp_tool_calls` logging that makes them queryable. Metrics as stated here are the target; the appendix is the honest measurement plan.

- **Reliability —** raw PostgREST traffic **against the test-case tables** from agent identities drops to ~zero. (Caveat: agents share the app's service-role key today, so this is only measurable if agents carry a distinguishable identity — see §12.)
- **Safety —** every agent write is preceded by a **payload-matched dry-run in the same session**. With OQ-4 Option A the server does not enforce this, so measuring it is how we detect the accepted risk — requires correlation-id + payload logging (§12).
- **Data quality —** **zero invalid rows land** in TCM (not "zero errors" — structured rejections are a _good_ signal the guard fires). Requires a **before baseline**: validate current `test_cases`/`test_steps` against the schema, then track new rows (§12).
- **Schema resilience —** agent error-rate stays **flat across schema-change deploys** (before MCP, a column rename breaks agents silently). A counterfactual, so measured indirectly (§12); the win is one MCP maintainer absorbing a break instead of N agents.

## 4. Out of Scope

- **Building** the MCP server scaffolding itself (process bootstrap, tool registration, packaging the git-distributed `npx` package) — that construction is the MCP server foundation epic. This epic decides the architecture it must follow (§9.1, OQ-3: `npx` local stdio, thin client proxying TCM REST) and specifies the tool contracts.
- Any tool beyond the six named below — no test-run, execution-result, bug-link, note, project, or suite-write tools. `search_suite` is read-only suite **lookup**, not suite management.
- Deletion of test cases (soft or hard). No `delete_test_case` tool in v1.
- Reordering / renumbering test cases (`reorder_test_cases` RPC is not exposed).
- Bulk operations (bulk update, bulk delete, CSV import).
- Any TCM/MCP-side posting to Slack. **The MCP server does not post to Slack or any chat** — it returns the dry-run summary to the agent, and the agent (Clutch for Torque, the chat for Claude Code) handles delivery and collects approval. TCM's existing run-notification Slack webhooks are unrelated to this flow. See **OQ-4** and the flow note in Section 6.
- Version history / audit trail on updates, including the `change_reason` field (see **OQ-1**).
  **In-scope prerequisite (not out of scope, flagged here):** because the data path proxies TCM REST (OQ-3), TCM must expose a **`display_id`-keyed REST surface** (get/create/update by `display_id` + suite lookup); its routes are UUID-keyed today. This REST work is a prerequisite for the tools and is tracked under OQ-3.

## 5. Users & User Stories (agent-facing)

The "users" of these tools are autonomous agents, not humans. A human enters the loop only to approve writes — in Slack (via Clutch) or in the LLM chat. The MCP tool returns the summary; the agent delivers it.

- **US-1 (resolve a suite):** As **Torque**, before I can create or list cases, I need to turn a suite name or prefix like "APA" into the ID the case tools expect, so I call `search_suite("APA")` and get back a suite reference — without knowing TCM's suite table.
- **US-2 (list cases):** As **triage-e2e**, I want to list the test cases in a suite (or matching a search term) with their automation status and priority, so I can find candidates for automation without loading full detail for every case.
- **US-3 (read a case):** As a **Claude agent**, I want the full detail of `APA-3` — precondition, description, all steps with expected results — by its human-readable ID, so I can understand what the case verifies before editing it.
- **US-4 (propose a new case, headless):** As **Torque** running with no human watching, I want to draft a new test case from a bug report, get the dry-run summary back from the tool, and post it to Slack **through Clutch** for a human to approve — so I never write an unreviewed case. After a human approves in the thread, I re-issue the call to commit it.
- **US-5 (propose an edit, in chat):** As a **Claude agent (Claude Code)** working alongside a human, when a test's steps drift from the automation I want the dry-run summary back so I can show the diff **inline in the chat**, so the human confirms in the same conversation before I overwrite the live case — no Slack round-trip.
- **US-6 (safety / no surprises):** As any agent, I want a `dry_run` write to **never** mutate TCM, and a non-dry-run write to require that a human has already approved, so I cannot accidentally commit unreviewed changes.

## 6. The Dry-Run → Approval → Commit Flow

All writes (`create_test_case`, `update_test_case`) follow the same two-pass contract.

**Who delivers the summary:** The MCP server **does not post anywhere** — not to Slack, not to any chat. A dry-run **returns a formatted summary to the calling agent**, and the agent is responsible for presenting it to a human and getting approval:

- **Torque (headless):** hands the summary to **Clutch**, which posts it to Slack; the human approves in Slack and Clutch relays the go-ahead back to the agent.
- **Claude Code (human in the loop):** renders the summary **inline in the chat**; the human approves in the same conversation. No Slack involved.

TCM's own Slack integration (`src/lib/slack/notify.ts`, `dispatch.ts` — run-completion webhooks) is **not** part of this flow. The MCP tool is delivery-agnostic: it emits the summary, nothing more.

The two-pass contract:

1. **Pass 1 — `dry_run: true` (required first).** The tool validates the input, resolves IDs, and computes a **diff-style summary** (for create: the full proposed case; for update: field-by-field before → after, plus a full steps before/after when `steps` is provided). It **returns that summary to the caller** and does **not** write to TCM. Delivering it to a human is the agent's job (Clutch→Slack for Torque, inline chat for Claude Code).
2. **Human approval — out of band.** A human reviews the summary and tells the agent to proceed — via Clutch/Slack, or a message in the LLM chat. **v1 has no interactive button/callback**; approval is a human message the agent observes, not a callback into TCM (see **OQ-4**).
3. **Pass 2 — `dry_run: false` (or omitted).** The agent re-issues the same call without dry-run. The tool re-validates, writes to TCM through the same code path as the UI/REST layer (`display_id` generated via the `generate_test_case_id` RPC on create; steps full-replaced on update), and returns the resulting `display_id` and canonical detail.

**Design note (v1 constraint):** Because delivery and approval happen entirely on the agent's side, the MCP server **cannot itself verify** that a human approved before Pass 2. **v1 accepts this** — "no write without approval" is a **process/orchestration** convention enforced by the agent + the human, not a hard technical gate (decided: OQ-4 Option A). A stricter approval-token gate is a deferred option, sketched in §9.3.

**Summary format:** The dry-run should return both a machine-readable diff and a human-readable rendering (markdown) so each agent can present it in its own channel — Clutch can wrap it for Slack, Claude Code can show the markdown directly. TCM does not format for any specific surface.

## 7. Schema Facts (verified against code)

These are the **code-verified** facts the tools must honor. Where they differ from the values stated in the epic brief, the code is authoritative and the delta is flagged. Sources: `supabase/migrations/00001_initial_schema.sql`, `src/lib/validations/test-case.ts`, `src/lib/validations/test-step.ts`, `src/types/database.ts`.

| Field                       | Verified fact                                                                                                                                                                                                                          | Note vs. brief                                                                                                                                           |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `priority`                  | `text` with CHECK in **`low`, `medium`, `high`, `critical`**, nullable. Zod: `z.enum(['low','medium','high','critical']).nullable()`                                                                                                   | Brief lists `high/medium/low/null` only. Schema **also allows `critical`**. **v1 exposes the brief's set only; `critical` deferred to v2 (§9.1, OQ-5).** |
| `automation_status`         | enum **`not_automated`, `scripted`, `in_cicd`, `out_of_sync`**, NOT NULL, default `not_automated`                                                                                                                                      | Matches brief.                                                                                                                                           |
| `type`                      | enum `functional`, `performance`, NOT NULL, default `functional`                                                                                                                                                                       | Brief says `functional` is the only value in use. Schema **also allows `performance`**. v1 may hard-default to `functional` and not expose `type`.       |
| `platform_tags`             | **`platform[]` — a constrained enum array of `desktop`, `tablet`, `mobile`**, NOT NULL, default `{}`                                                                                                                                   | ⚠️ Brief says "string array". It is **not** free-form; values are restricted to `desktop/tablet/mobile`. Tool schema must enforce this.                  |
| `tags`                      | `text[]`, free strings (each ≤50 chars), NOT NULL, default `{}`                                                                                                                                                                        | Matches brief (free string array).                                                                                                                       |
| `display_id`                | `text`, format `<suite.prefix>-<sequence_number>` (e.g. `APA-3`). Prefix lives on **`suites.prefix`**; numbering from `suites.next_sequence`. **Partial-unique on active rows only** (`WHERE deleted_at IS NULL`).                     | Resolution must scope to **active** (non-soft-deleted) rows.                                                                                             |
| `project_id` on a case      | **Does not exist on `test_cases`.** Project is reached via `suite_id → suites.project_id`.                                                                                                                                             | `list_test_cases(project_id?)` must join through suites.                                                                                                 |
| Steps                       | Table `test_steps`: `step_number` (int, ≥1, unique per case), `description` (required), `test_data?`, `expected_result?`, `is_automation_only` (bool, default false), `category?`. **Full-replace** semantics (delete all + reinsert). | Matches brief's "steps are full-replace".                                                                                                                |
| `created_by` / `updated_by` | uuid, **NOT NULL** (`created_by`) FK → `profiles`.                                                                                                                                                                                     | Agent writes need an attributed profile id — see **OQ-2** / write-attribution note.                                                                      |
| `in_cicd` lock              | When a case's `automation_status` is `in_cicd`, its `display_id` **cannot be changed** (enforced in `PATCH /api/test-cases/[id]`).                                                                                                     | `update_test_case` must respect this.                                                                                                                    |

Fields the brief says **not to invent** and which are confirmed **absent** from the schema: `environment`, `risk_area`, `external_id`. Tools must not accept or return them.

## 8. Tool Specifications

General contract for all tools:

- **Data path:** Per OQ-3, the MCP server is a thin client — each tool call proxies a **TCM REST endpoint** (it does not touch Supabase directly). References below to the `generate_test_case_id` RPC, the `in_cicd` lock, etc. describe what TCM does behind that REST call, not direct MCP→DB access.
- **ID handling:** Agents pass `display_id` (cases) and suite references. The MCP server resolves to UUIDs internally (against the `display_id`-keyed REST surface) and never returns a test-case UUID to the agent.
- **Validation:** Inputs validated against the enums/shapes in Section 7 before any read or write. Invalid input returns a structured error, not a silent coercion.
- **Errors:** Return a structured error object `{ error: { code, message } }` — e.g. `NOT_FOUND` (unknown `display_id`/suite), `AMBIGUOUS` (search matches >1 suite), `VALIDATION` (bad enum/shape), `IN_CICD_LOCKED` (illegal display_id change). Mirror TCM's existing error style (`{ error, code }`). _(No `DRY_RUN_REQUIRED` code in v1 — with OQ-4 Option A the server does not enforce a prior dry-run; that code would only appear if the deferred token gate is added.)_

---

### 8.1 `search_suite`

Resolve a suite name or prefix to a suite reference. Lightweight; agents call this before the case tools.

**Input**

| Param            | Type          | Req | Notes                                                                                |
| ---------------- | ------------- | --- | ------------------------------------------------------------------------------------ |
| `project_id`     | string (uuid) | yes | Scopes the search; prefix is only unique per project (`UNIQUE(project_id, prefix)`). |
| `name_or_prefix` | string        | yes | Matches suite `name` or `prefix`, case-insensitive, prefix-or-substring.             |

**Output** — array of matches (usually one):

```json
[
  {
    "suite_id": "uuid",
    "name": "Account & Profile",
    "prefix": "APA",
    "project_id": "uuid"
  }
]
```

- 0 matches → `NOT_FOUND`. >1 match → return all so the agent (or human) can disambiguate; the agent must not guess.
- `suite_id` **is** returned here (suites are not the entity we hide) — the case tools accept it. Only **test-case** UUIDs are hidden.

---

### 8.2 `list_test_cases`

Filterable, lightweight list of cases.

**Input**

| Param        | Type          | Req | Notes                                                                                     |
| ------------ | ------------- | --- | ----------------------------------------------------------------------------------------- |
| `project_id` | string (uuid) | no  | Filters via `suite_id → suites.project_id` join.                                          |
| `suite_id`   | string (uuid) | no  | Direct filter.                                                                            |
| `search`     | string        | no  | Matches `display_id` or `title` (ilike), mirroring the existing list route.               |
| `limit`      | int           | no  | Default **50**, max **200**. Values >200 clamp to 200 (and note the clamp in the result). |

- At least one of `project_id` / `suite_id` / `search` should be provided; an unscoped full-table list is discouraged (still capped at `limit`).
- Only **active** cases (`deleted_at IS NULL`).

**Output** — array of lightweight rows:

```json
[
  {
    "display_id": "APA-3",
    "title": "User can reset password",
    "automation_status": "not_automated",
    "priority": "high"
  }
]
```

Optionally a `total`/`has_more` indicator for pagination. No steps, no UUIDs.

---

### 8.3 `get_test_case`

Full detail for a single case, including all steps.

**Input**

| Param        | Type   | Req | Notes                                                       |
| ------------ | ------ | --- | ----------------------------------------------------------- |
| `display_id` | string | yes | e.g. `APA-3`. MCP resolves to UUID against **active** rows. |

**Output** — full case projection:

```json
{
  "display_id": "APA-3",
  "suite": { "suite_id": "uuid", "prefix": "APA", "name": "Account & Profile" },
  "title": "User can reset password",
  "precondition": "User has a registered account",
  "description": "…",
  "priority": "high",
  "automation_status": "not_automated",
  "type": "functional",
  "platform_tags": ["desktop", "mobile"],
  "tags": ["auth", "smoke"],
  "steps": [
    {
      "step_number": 1,
      "description": "Navigate to /forgot-password",
      "test_data": null,
      "expected_result": "Reset form shown",
      "is_automation_only": false
    }
  ]
}
```

- Unknown `display_id` → `NOT_FOUND`. Returns no internal UUID for the case itself.

---

### 8.4 `create_test_case`

Create a case (with steps) via dry-run → approval → commit.

**Input**

| Param               | Type           | Req | Notes                                                                                                                                |
| ------------------- | -------------- | --- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `suite_id`          | string (uuid)  | yes | From `search_suite`. Drives `display_id` prefix + numbering.                                                                         |
| `title`             | string         | yes | 1–500 chars.                                                                                                                         |
| `precondition`      | string \| null | no  | ≤5000.                                                                                                                               |
| `description`       | string \| null | no  | ≤5000.                                                                                                                               |
| `priority`          | enum \| null   | no  | `low`/`medium`/`high`, or null (`critical` deferred to v2, OQ-5).                                                                    |
| `automation_status` | enum           | no  | Default `not_automated`.                                                                                                             |
| `platform_tags`     | array<enum>    | no  | Subset of `desktop`/`tablet`/`mobile`. Default `[]`.                                                                                 |
| `tags`              | array<string>  | no  | Free strings, each ≤50. Default `[]`.                                                                                                |
| `steps`             | array<Step>    | yes | Ordered; each `{ description (req), test_data?, expected_result?, is_automation_only? }`. `step_number` assigned by order (1-based). |
| `dry_run`           | boolean        | no  | `true` → return summary to the caller, no write. Omitted/`false` → commit.                                                           |

**Behavior**

- Dry-run: validate, resolve suite, compute and **return** the summary (**the assigned `display_id` is not known pre-write** — it comes from the `generate_test_case_id` RPC at insert time; the summary shows suite prefix + proposed content and notes the ID is assigned on commit). No write; the MCP server does not deliver the summary anywhere — the agent does.
- Commit: insert case (display_id via `generate_test_case_id` RPC, position computed as in the existing POST route), insert steps. Attributed to the agent's write identity (**OQ-2**).

**Output**

- Dry-run: `{ dry_run: true, would_create: { …proposed case + steps… }, summary_markdown: "…" }` — the agent delivers this to a human (Clutch→Slack or inline chat).
- Commit: the committed case in the `get_test_case` shape (with the real `display_id`).

---

### 8.5 `update_test_case`

Partial update of an existing case; steps are **full-replace** when provided.

**Input**

| Param               | Type           | Req | Notes                                                                                   |
| ------------------- | -------------- | --- | --------------------------------------------------------------------------------------- |
| `display_id`        | string         | yes | Target case. MCP resolves to UUID.                                                      |
| `title`             | string         | no  | Partial.                                                                                |
| `precondition`      | string \| null | no  |                                                                                         |
| `description`       | string \| null | no  |                                                                                         |
| `priority`          | enum \| null   | no  |                                                                                         |
| `automation_status` | enum           | no  |                                                                                         |
| `platform_tags`     | array<enum>    | no  | `desktop`/`tablet`/`mobile`.                                                            |
| `tags`              | array<string>  | no  |                                                                                         |
| `steps`             | array<Step>    | no  | **If present, wipes and replaces ALL existing steps.** If omitted, steps are untouched. |
| `dry_run`           | boolean        | no  | Same semantics as create.                                                               |

**Behavior**

- Only the fields supplied are changed. Omitted fields are untouched.
- **Steps full-replace:** passing `steps` deletes all existing `test_steps` and reinserts the provided array (matching the existing `PUT /steps` route). The dry-run summary must show the **full before/after step list**, since a partial-looking call can wipe steps.
- The tool does **not** accept a `display_id` change. (Renaming display_id is out of scope, and is `in_cicd`-locked in TCM anyway → `IN_CICD_LOCKED` if ever attempted.)
- Commit attributes to the agent's write identity via `updated_by` (**OQ-2**).

**Output**

- Dry-run: `{ dry_run: true, diff: { field: { before, after }, … }, steps_before: [...], steps_after: [...], summary_markdown: "…" }` — the agent delivers this to a human (Clutch→Slack or inline chat).
- Commit: updated case in the `get_test_case` shape.

---

## 9. Decisions & Open Questions

### 9.1 Decisions (resolved)

- **OQ-1 — `change_reason` / version history. → DECIDED: out of scope for v1.** We do **not** add a `change_reason` field, and version history is not part of this epic. The tools do not accept `change_reason`. (TCM has no field-level update audit trail today; adding one remains a separate, future decision, but nothing in this epic depends on it.)

- **OQ-2 — MCP auth + write attribution. → DECIDED: two auth modes.** The MCP server authenticates one of two ways depending on the caller:
  - **Clutch key (headless agents — Torque via Clutch/OpenClaw).** Reuse the existing **`X-Clutch-Key`** / `CLUTCH_API_KEY`, which already yields a service-role Supabase client via `withAgentAuth` (`src/lib/api/helpers.ts`). No new key needed for v1.
  - **User auth token (interactive — Claude Code).** The MCP server acquires the **user's own Supabase session/JWT by logging in through the Playwright MCP** (the same browser-login pattern TCM already uses for Playwright auth, `scripts/save-playwright-auth.mjs` + `playwright/.auth/user.json`). Writes then run as that real user under normal RLS.
  - **Write attribution follows the mode:** user-token writes attribute `created_by`/`updated_by` to that user's profile; Clutch-key writes are service-role and need a designated identity — **residual sub-question:** which profile do Clutch-key writes attribute to (a dedicated "agent"/service profile vs. per-agent profiles)? _(Also: the Clutch-key check is a plain, non-constant-time string compare — worth hardening.)_

- **OQ-4 — Enforcing approval before commit. → DECIDED: Option A (process-only).** v1 does **not** build an approval-token gate. "No write without approval" is a **process/orchestration convention** enforced by the agent + the human (Torque via Clutch→Slack; Claude Code inline in chat) — the MCP server does not verify it. Known, accepted risk: a buggy or misbehaving agent could skip the dry-run and call with `dry_run: false` directly. The approval-token design (mint on dry-run → human acks → commit consumes a payload-matched, single-use token) is **deferred to a later version** if this convention proves insufficient; it is preserved in §9.3 for reference.

- **OQ-5 — Enum surface (`critical`, `performance`). → DECIDED: defer to v2.** v1 exposes the narrow brief set only (`priority` ∈ `low`/`medium`/`high`/null; `type` fixed to `functional`, not exposed). Widening to the schema's `priority: critical` and `type: performance` is a **v2** consideration.

- **OQ-3 — MCP server location, install & data path. → DECIDED.**
  - **Transport & install: `npx`-launched local stdio server.** The MCP server ships as a package run as a local subprocess — the standard MCP install pattern and the same mechanism this repo already uses for the Playwright MCP in `.mcp.json`. Uniform across **both** install targets:
    - **Local developer machine (Claude Code):** an `npx` entry in the developer's `.mcp.json` / user MCP settings, carrying the **user-token** auth path (OQ-2 — Playwright login → Supabase JWT).
    - **Clutch / OpenClaw instance (headless agents):** the OpenClaw runtime launches the same `npx` server in each spawned Torque session (`POST /api/sessions/spawn`), carrying the **Clutch-key** auth path. (Depends on `OPENCLAW_INTEGRATION_ENABLED`, not live yet.)
  - **Distribution: git URL — no npm publish.** The package is **not** published to npm (public or private). Hosts run it straight from the repo via a pinned git spec, e.g. `npx github:JoinFullStackDev/tcm-mcp#v1.0.0` (tag or commit — not a floating branch). Implications: (1) each host needs **git read access** to the repo — dev machines typically already have it; the **OpenClaw/Torque hosts need a git token** in their image/env. (2) Because npx clones and builds from source, the package needs a **`prepare` build step** (TS→JS on install) or a committed `dist/`. (3) Pin by tag/commit for reproducibility; bump the pin to roll out changes. The `.mcp.json` entry therefore references the git spec, not a bare `npx tcm-mcp` (which would imply the public registry).
  - **Data path: proxy the TCM REST API (option 2).** The local server is a **thin client** — it does **not** touch Supabase directly. Every tool call maps to a TCM REST endpoint, so ID resolution, Zod validation, the `generate_test_case_id` RPC, the `in_cicd` lock, soft-delete scoping, and any audit logging stay centralized in TCM. Each host holds only a TCM base-URL + an auth credential (Clutch key or user JWT — OQ-2), never Supabase service creds. The server is thus effectively a standalone git-distributed package (not a Vercel function); where its _source_ lives (in-repo workspace vs. its own repo) is a minor code-org choice, not architectural — though the git-spec distribution assumes a repo the hosts can clone.
  - **⚠️ Dependency this creates:** TCM's REST API is **UUID-keyed today** — there is no `display_id`→case surface. Proxying therefore requires either (a) **new `display_id`-keyed REST endpoints** on TCM (get/create/update by `display_id`, plus suite lookup), or (b) the MCP server resolves `display_id`→UUID via the existing `GET /api/test-cases?search=` list route and then calls the UUID-keyed endpoints. **Recommend (a)** for a clean contract. Either way, this REST work is a **prerequisite** for the epic and should be tracked as such.

### 9.2 Open Questions (still open)

- **OQ-2 residual — write attribution on the Clutch-key path.** The service-role (headless) path has no real user, but `created_by`/`updated_by` are NOT NULL. Which profile do those writes attribute to — a dedicated "agent"/service profile, or per-agent profiles? (The user-JWT path attributes to the real user automatically.)
- **OQ-6 — Is `dry_run` a server-side REST concept?** Detailed in **§12.3**. Recommend making `dry_run` a `?dry_run=true` REST concept (validates + diffs + logs, no write) so the safety metric is measurable and validation runs on the dry-run too; not yet decided.

### 9.3 Deferred designs (not in v1)

- **OQ-4 Option B — approval token (kept for reference only; v1 uses Option A).** Make Pass 2 impossible without proof the dry-run happened and a human acked it. (1) **Mint on dry-run** — Pass 1 persists the exact proposed payload server-side under a short-lived, single-use `approval_token` in a **pending** state and returns it with the summary. (2) **Human acks** — approval flips the token to **approved** server-side via a callback (Clutch calls `POST /mcp/approvals/{token}/approve` on Slack approval; Claude Code surfaces an equivalent approve action). (3) **Commit consumes** — Pass 2 must send `approval_token`; the server writes only if it is approved, unexpired, unused, and its stored payload **matches** the commit payload (can't approve X then commit Y), then burns it. Cost: token storage + expiry, an approval-callback endpoint, and ack integration on both surfaces — which is why it is out of v1.

## 10. Appendix — Key References

| Concern                                                     | Path                                                      |
| ----------------------------------------------------------- | --------------------------------------------------------- |
| Test-case create/list route (display_id RPC, position calc) | `src/app/api/test-cases/route.ts`                         |
| Test-case update route (`in_cicd` display_id lock)          | `src/app/api/test-cases/[testCaseId]/route.ts`            |
| Steps full-replace route                                    | `src/app/api/test-cases/[testCaseId]/steps/route.ts`      |
| Data-access repository (active-scope convention)            | `src/lib/db/test-case-repository.ts`                      |
| Test-case / step Zod schemas (enum source of truth)         | `src/lib/validations/test-case.ts`, `test-step.ts`        |
| Schema + `generate_test_case_id` RPC                        | `supabase/migrations/00001_initial_schema.sql`            |
| `display_id` partial-unique (active rows)                   | `supabase/migrations/00038_partial_display_id_unique.sql` |
| Clutch/agent auth helpers (`X-Clutch-Key`)                  | `src/lib/api/helpers.ts`                                  |
| Slack Block Kit builder + webhook POST                      | `src/lib/slack/notify.ts`, `src/lib/slack/dispatch.ts`    |
| Valid agent identities (incl. `torque`)                     | `src/lib/validations/agent-run.ts`                        |

---

## 11. Appendix B — Prerequisite REST surface (`display_id`-keyed)

Because the MCP server proxies TCM REST (OQ-3, option 2), TCM must expose endpoints the tools can call **one-for-one**. TCM's routes are UUID-keyed today; this appendix specs the additions/extensions needed. This is **prerequisite build work for TCM**, tracked under OQ-3 — the MCP epic depends on it but does not itself build it.

### Conventions (match existing TCM routes)

- **Auth:** all endpoints below use **`withAgentAuth()`** (`src/lib/api/helpers.ts`) — accepts `X-Clutch-Key` (→ service-role, headless path) **or** `Authorization: Bearer <supabase-jwt>` (→ user RLS, interactive path). This is exactly OQ-2's two modes; no new auth code.
- **Validation:** reuse the existing Zod schemas (`createTestCaseSchema`, `updateTestCaseSchema`, `stepSchema`) — but constrain the exposed enum surface to the v1 set (OQ-5): `priority` ∈ `low`/`medium`/`high`/null, `type` fixed to `functional`.
- **Errors:** reuse TCM's shapes — `validationError` → `{ error: 'Validation failed', details }` (400); `notFound` → `{ error: '<entity> not found' }` (404); `conflict` (409); agent routes also carry a machine `code`. Add codes: `AMBIGUOUS_SUITE`, `IN_CICD_LOCKED`.
- **Scope:** all reads/resolution are **active-only** (`deleted_at IS NULL`), via `TestCaseRepository`'s default scope. `display_id` resolves against active rows only (it is partial-unique on active rows).
- **Fields:** snake_case, matching the DB/TS types.

### Tool → endpoint map

| MCP tool                    | REST endpoint                                              | New / extend                                                  |
| --------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------- |
| `search_suite`              | `GET /api/projects/{projectId}/suites?search=`             | **extend** (add `search` filter)                              |
| `list_test_cases`           | `GET /api/test-cases?project_id=&suite_id=&search=&limit=` | **extend** (add `project_id`, `limit` clamp, lean projection) |
| `get_test_case`             | `GET /api/test-cases/by-display-id/{displayId}`            | **new**                                                       |
| `create_test_case` (commit) | `POST /api/test-cases` (accept inline `steps[]`)           | **extend** (atomic case + steps)                              |
| `update_test_case` (commit) | `PATCH /api/test-cases/by-display-id/{displayId}`          | **new** (partial + steps full-replace)                        |

**Dry-run needs no write endpoints** — it is pure reads: `get_test_case` (update before-state), `search_suite` (create prefix). The commit endpoints are the only writes.

### E1 — Suite lookup (extend)

`GET /api/projects/{projectId}/suites?search={name_or_prefix}`

- Filters the existing suites list; case-insensitive match on `name` **or** `prefix`. Omitting `search` returns all (current behavior, unchanged).
- **200:** `[{ "id": "uuid", "name": "Account & Profile", "prefix": "APA", "project_id": "uuid" }]`
- The MCP maps this to `search_suite`; 0 matches → tool returns `NOT_FOUND`, >1 → tool returns `AMBIGUOUS` with all rows (endpoint itself just returns the array).

### E2 — List cases (extend)

`GET /api/test-cases?project_id={uuid}&suite_id={uuid}&search={str}&limit={n}`

- Adds an optional **`project_id`** filter (join `suite:suites(project_id)` — cases have no direct `project_id`). `suite_id` and `search` (ilike on `display_id`/`title`) already exist.
- **`limit`** default 50, **clamp to max 200**. Include `has_more`/`total` for paging.
- Lean projection for this caller (either a `fields=lean` flag or MCP-side projection): `display_id`, `title`, `automation_status`, `priority`.
- **200:** `{ "items": [{ "display_id": "APA-3", "title": "…", "automation_status": "not_automated", "priority": "high" }], "total": 12, "has_more": false }`

### E3 — Get case by display_id (new)

`GET /api/test-cases/by-display-id/{displayId}`

- Resolves `display_id` → UUID against active rows, returns full detail **with steps** (reuse `findByIdWithRelations`).
- **200:** the `get_test_case` shape (§8.3) — case fields + `suite` + ordered `steps[]`.
- **404:** `{ error: 'Test case not found' }` (unknown/deleted `display_id`).

### E4 — Create with inline steps (extend)

`POST /api/test-cases`

- Extend the existing create to accept an optional **`steps[]`** array and insert case **+ steps in one transaction** (today: case via `POST`, steps via a separate `PUT /steps`). Atomicity matters so a committed case is never stepless.
- **Body:** `createTestCaseSchema` fields (`suite_id`, `title`, `precondition?`, `description?`, `priority?`, `automation_status?`, `platform_tags?`, `tags?`) **+ `steps[]`** (`stepSchema` items; `step_number` assigned by array order).
- Server generates `display_id` via `generate_test_case_id` RPC and computes `position` (unchanged).
- **201:** created case in the `get_test_case` shape (real `display_id` + steps).
- **400:** `validationError`. Write RBAC via RLS (user path) or service-role (Clutch path).

### E5 — Update by display_id, steps full-replace (new)

`PATCH /api/test-cases/by-display-id/{displayId}`

- Resolves `display_id` → UUID, applies a **partial** update, and — if `steps[]` is present — **wipes and replaces all steps** (same semantics as the existing `PUT /steps`), in one transaction. Omitting `steps` leaves steps untouched.
- **Body:** `updateTestCaseSchema` fields (v1 subset) **+ optional `steps[]`**. Does **not** accept a `display_id` change; if the case is `in_cicd`, any display_id change is rejected → `409 IN_CICD_LOCKED` (mirrors the existing lock).
- **200:** updated case in the `get_test_case` shape.
- **404:** unknown/deleted `display_id`. **400:** `validationError`.

### Notes / open sub-points

- **Resolver reuse:** E3 and E5 share one internal `resolveDisplayId(displayId) → uuid | null` helper (active-scope). If TCM prefers not to add `by-display-id` paths, the fallback (OQ-3 option b) is: MCP calls E2 with `search={displayId}`, takes the exact `display_id` match, then hits the existing UUID routes — more round-trips, and it leaks the two-step resolution into the MCP. Dedicated endpoints (above) are recommended.
- **Attribution:** on the Clutch-key (service-role) path, `created_by`/`updated_by` still need a value — see OQ-2's residual sub-question (which profile). The user-JWT path attributes to the real user automatically.

---

## 12. Appendix C — Success metrics: measurement & instrumentation

The §3 metrics are only real if we can measure them. This appendix is the measurement plan. **Bottom line:** because the data path proxies TCM REST (OQ-3, option 2), **every tool call already crosses a TCM REST endpoint** — so we log **server-side at that boundary**, not in the MCP client. That is centralized, queryable, and **tamper-resistant** (a buggy/misbehaving agent cannot skip it — which matters precisely because OQ-4 Option A does not enforce the dry-run in code). This partially recovers the "no central observability" con listed under OQ-3, which really applied to the rejected direct-Supabase variant.

### 12.1 Instrumentation — `mcp_tool_calls` (in-scope requirement)

One row per proxied tool call, written at the TCM REST boundary. This single table makes all four signals queryable.

| Column                             | Purpose                                                                                         |
| ---------------------------------- | ----------------------------------------------------------------------------------------------- |
| `correlation_id`                   | Ties a dry-run to its commit (and both to an agent session).                                    |
| `tool`                             | `search_suite` / `list_test_cases` / `get_test_case` / `create_test_case` / `update_test_case`. |
| `dry_run`                          | boolean.                                                                                        |
| `intent`                           | e.g. `dry-run-update`, `commit-create` — disambiguates a dry-run read from a plain read.        |
| `actor_identity`                   | Clutch-key (which agent) vs. user JWT (which user).                                             |
| `resolved_display_id` / `suite_id` | Target of the call.                                                                             |
| `payload_hash`                     | Hash of the normalized write payload — lets us prove a commit **matches** its approved dry-run. |
| `outcome` / `error_code`           | success / `VALIDATION` / `NOT_FOUND` / `IN_CICD_LOCKED` / …                                     |
| `created_at`                       | timestamp.                                                                                      |

**Two headers the MCP must stamp on proxied requests** so the boundary log is complete: `X-MCP-Correlation-Id` (groups dry-run ↔ commit ↔ session) and `X-MCP-Intent`. Without them, a dry-run for an update is just an ambiguous `GET`.

### 12.2 How each signal is measured

- **Reliability —** count PostgREST calls hitting `test_cases`/`test_steps` attributed to **agent identities**, over time; target ≈ 0 post-MCP. **Prerequisite:** agents must be distinguishable in Supabase logs — today they share `SUPABASE_SERVICE_ROLE_KEY` with the app backend, so filter by source (agent host IP / distinct key), not by the shared key alone. Scope to test-case tables only (v1 moves only test-case CRUD).
- **Safety —** query `mcp_tool_calls` for commits (`dry_run=false`, write tools) with **no preceding `dry_run=true` row of matching `correlation_id` and `payload_hash`**. Target 0; any hit is the OQ-4 Option-A risk materializing (detected, not prevented).
- **Data quality —** **baseline first:** run the current Zod schema over existing `test_cases`/`test_steps`, record the violation count. Post-MCP, track invalid rows _landed_ (should stay flat/zero) and, as a positive signal, the count of `outcome=VALIDATION` rejections (the guard doing its job). Framed as "zero invalid rows land," not "zero errors."
- **Schema resilience —** track agent error-rate (from `mcp_tool_calls.outcome` and agent-run failures) in a window around migration deploys. Before MCP: expect spikes on schema changes. After: flat. Acknowledge it's a counterfactual — the benefit is a single MCP maintainer absorbing a break vs. N agents breaking silently; a TCM REST **response-shape** change can still break the MCP.

### 12.3 Open question

- **OQ-6 — Is `dry_run` a server-side REST concept?** Option A (current tool contract): the MCP computes the dry-run diff from reads, and `dry_run` never reaches TCM as a write intent. Option B: add `?dry_run=true` to the create/update REST endpoints (E4/E5) — TCM validates + computes the diff + logs it explicitly but does not write. Option B makes the safety metric trivially measurable, runs validation on the dry-run too, and is effectively the "mint" half of OQ-4 Option B already built (cheap upgrade path later). Trade-off: dry-run handling lands in the REST endpoints. **Recommend Option B** for measurability; not yet decided.
