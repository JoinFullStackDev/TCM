-- Agent Monitor v2 enhancements
-- Adds task metadata fields to agent_runs and introduces run_notes table.

ALTER TABLE agent_runs
  ADD COLUMN IF NOT EXISTS task_title       VARCHAR(256),
  ADD COLUMN IF NOT EXISTS task_description TEXT,
  ADD COLUMN IF NOT EXISTS expected_outcome TEXT;

CREATE TABLE IF NOT EXISTS run_notes (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id     UUID         NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  author     VARCHAR(256) NOT NULL,
  note       TEXT         NOT NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_run_notes_run_id ON run_notes (run_id);
ALTER TABLE run_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read_run_notes" ON run_notes FOR SELECT TO authenticated USING (true);
