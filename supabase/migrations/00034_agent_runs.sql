-- Agent Activity Monitor — agent_runs table
-- Implements: ARC plan "Architecture: TCM Agent Activity Monitor" (2026-05-30)

-- Status enum (enforced at DB level)
CREATE TYPE agent_run_status AS ENUM (
  'spawned',
  'running',
  'waiting',
  'done',
  'failed',
  'timed_out',
  'killed'
);

-- Agent enum
CREATE TYPE agent_name AS ENUM (
  'axel', 'riff', 'arc', 'torque', 'clutch'
);

-- Main table
CREATE TABLE agent_runs (
  id               UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  agent            agent_name        NOT NULL,
  brief            TEXT              NOT NULL CHECK (char_length(brief) <= 512),
  status           agent_run_status  NOT NULL DEFAULT 'spawned',
  session_key      VARCHAR(128)      NOT NULL UNIQUE,
  spawned_by       VARCHAR(256)      NOT NULL,
  slack_channel    VARCHAR(64),
  slack_thread_ts  VARCHAR(64),
  project_tag      VARCHAR(64),
  started_at       TIMESTAMPTZ       NOT NULL,
  last_heartbeat   TIMESTAMPTZ,
  ended_at         TIMESTAMPTZ,
  output_tail      TEXT,
  output_truncated BOOLEAN           NOT NULL DEFAULT FALSE,
  parent_run_id    UUID              REFERENCES agent_runs(id) ON DELETE SET NULL,
  archived_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ       NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ       NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_agent_runs_status        ON agent_runs(status);
CREATE INDEX idx_agent_runs_agent         ON agent_runs(agent);
CREATE INDEX idx_agent_runs_project_tag   ON agent_runs(project_tag);
CREATE INDEX idx_agent_runs_parent_run_id ON agent_runs(parent_run_id);
CREATE INDEX idx_agent_runs_spawned_by    ON agent_runs(spawned_by);
CREATE INDEX idx_agent_runs_started_at    ON agent_runs(started_at DESC);
CREATE INDEX idx_agent_runs_active        ON agent_runs(status) WHERE archived_at IS NULL;
-- Partial index for default list query (non-archived)
CREATE INDEX idx_agent_runs_unarchived    ON agent_runs(started_at DESC) WHERE archived_at IS NULL;

-- Auto-update updated_at trigger function (create only if not already defined)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agent_runs_updated_at
  BEFORE UPDATE ON agent_runs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS: permissive authenticated-user policy (single-org tool)
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY agent_runs_authenticated ON agent_runs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Cron jobs (via pg_cron if available)
DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Timeout cron: every 2 minutes — mark stale active runs as timed_out
    PERFORM cron.schedule(
      'timeout-agent-runs',
      '*/2 * * * *',
      $$
        UPDATE agent_runs
        SET status = 'timed_out', ended_at = now(), updated_at = now()
        WHERE status IN ('spawned', 'running', 'waiting')
          AND archived_at IS NULL
          AND COALESCE(last_heartbeat, started_at) < now() - (
            COALESCE(current_setting('app.agent_timeout_minutes', true), '10')::int * interval '1 minute'
          );
      $$
    );

    -- Archive cron: hourly — soft-archive terminal runs older than 24h
    PERFORM cron.schedule(
      'archive-agent-runs',
      '0 * * * *',
      $$
        UPDATE agent_runs
        SET archived_at = now(), updated_at = now()
        WHERE status IN ('done', 'failed', 'timed_out', 'killed')
          AND ended_at < now() - INTERVAL '24 hours'
          AND archived_at IS NULL;
      $$
    );
  END IF;
END;
$guard$;
