-- Migration: agent_runs table for FullThrottle agent run visibility
-- Feature: /agents panel in TCM Command Center

CREATE TYPE agent_run_status AS ENUM (
  'spawned',
  'running',
  'waiting',
  'done',
  'failed',
  'timed_out',
  'killed'
);

CREATE TYPE agent_name AS ENUM (
  'axel',
  'riff',
  'arc',
  'torque',
  'clutch'
);

CREATE TABLE agent_runs (
  id               UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  agent            agent_name       NOT NULL,
  brief            TEXT             NOT NULL CHECK (char_length(brief) <= 512),
  status           agent_run_status NOT NULL DEFAULT 'spawned',
  session_key      VARCHAR(128)     NOT NULL UNIQUE,
  spawned_by       VARCHAR(256)     NOT NULL,
  slack_channel    VARCHAR(64),
  slack_thread_ts  VARCHAR(64),
  project_tag      VARCHAR(64),
  started_at       TIMESTAMPTZ      NOT NULL,
  last_heartbeat   TIMESTAMPTZ,
  ended_at         TIMESTAMPTZ,
  output_tail      TEXT,
  output_truncated BOOLEAN          NOT NULL DEFAULT FALSE,
  parent_run_id    UUID             REFERENCES agent_runs(id) ON DELETE SET NULL,
  archived_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ      NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ      NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_agent_runs_status        ON agent_runs (status);
CREATE INDEX idx_agent_runs_agent         ON agent_runs (agent);
CREATE INDEX idx_agent_runs_started_at    ON agent_runs (started_at DESC);
CREATE INDEX idx_agent_runs_parent_run_id ON agent_runs (parent_run_id);
CREATE INDEX idx_agent_runs_session_key   ON agent_runs (session_key);
CREATE INDEX idx_agent_runs_project_tag   ON agent_runs (project_tag);
CREATE INDEX idx_agent_runs_archived_at   ON agent_runs (archived_at) WHERE archived_at IS NULL;
CREATE INDEX idx_agent_runs_last_hb       ON agent_runs (last_heartbeat);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION set_agent_runs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_agent_runs_updated_at
  BEFORE UPDATE ON agent_runs
  FOR EACH ROW
  EXECUTE FUNCTION set_agent_runs_updated_at();

-- RLS: allow authenticated users to read; service role used for writes from API
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_agent_runs"
  ON agent_runs
  FOR SELECT
  TO authenticated
  USING (true);

-- Service role bypasses RLS for all write operations
