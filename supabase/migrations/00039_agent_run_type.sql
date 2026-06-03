-- Migration 00039: Add run_type enum to agent_runs
-- Distinguishes Clutch orchestrator runs from subagent runs.
-- All existing rows default to 'subagent' with no backfill required.

CREATE TYPE agent_run_type AS ENUM ('subagent', 'orchestrator');

ALTER TABLE agent_runs
  ADD COLUMN IF NOT EXISTS run_type agent_run_type NOT NULL DEFAULT 'subagent';

CREATE INDEX IF NOT EXISTS idx_agent_runs_run_type ON agent_runs(run_type);
