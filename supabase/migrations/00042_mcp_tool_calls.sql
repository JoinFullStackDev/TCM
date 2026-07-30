-- Migration 00042: mcp_tool_calls instrumentation table
--
-- One row per MCP tool call proxied through TCM REST endpoints.
-- Enables measurement of the four MCP success signals (PRD §3, Appendix C):
--   - Reliability: agent PostgREST traffic vs. MCP traffic
--   - Safety: commits preceded by a matched dry-run (correlation_id + payload_hash)
--   - Data quality: validation rejection count vs. successful writes
--   - Schema resilience: error-rate across deploys
--
-- Written at the REST boundary (server-side), so it cannot be skipped by a
-- misbehaving agent. This is the central audit log for the dry-run → approval
-- → commit flow (OQ-4 Option A accepted risk measurement).

CREATE TABLE mcp_tool_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Groups dry-run and its matching commit in the same agent session.
  -- Stamped by the MCP client as X-MCP-Correlation-Id.
  correlation_id text,

  -- Which MCP tool was called:
  -- search_suite | list_test_cases | get_test_case | create_test_case | update_test_case
  tool text NOT NULL,

  -- Whether this was a dry-run (no write) or a commit call.
  dry_run boolean NOT NULL DEFAULT false,

  -- Human-readable intent tag: e.g. 'dry-run-create', 'commit-update', 'dry-run-update'.
  -- Stamped by the MCP client as X-MCP-Intent.
  intent text,

  -- Identifies the caller: 'clutch-key' (headless Torque path) or 'bearer-jwt' (Claude Code path).
  actor_identity text,

  -- The resolved display_id targeted by the call (for case tools).
  resolved_display_id text,

  -- The suite_id involved (for suite and case tools).
  suite_id uuid,

  -- SHA-256 hash of the normalized write payload.
  -- Lets us verify a commit payload matches its approved dry-run payload.
  payload_hash text,

  -- Outcome of the call: 'success' | 'dry_run_returned' | 'validation_error' |
  -- 'not_found' | 'in_cicd_locked' | 'ambiguous' | 'pending' | 'error'
  outcome text,

  -- Structured error code if outcome is an error: NOT_FOUND | AMBIGUOUS |
  -- VALIDATION | IN_CICD_LOCKED
  error_code text,

  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for joining dry-run → commit in the same session
CREATE INDEX mcp_tool_calls_correlation_id_idx ON mcp_tool_calls (correlation_id);

-- Index for time-range queries and recent-call dashboards
CREATE INDEX mcp_tool_calls_created_at_idx ON mcp_tool_calls (created_at DESC);
