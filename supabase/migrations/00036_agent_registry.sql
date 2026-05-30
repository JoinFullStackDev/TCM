-- Agent Registry
-- Stores metadata about registered FullThrottle agents.

CREATE TYPE agent_status AS ENUM ('active', 'idle', 'offline', 'degraded');

CREATE TABLE IF NOT EXISTS agents (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(64)   NOT NULL UNIQUE,
  display_name    VARCHAR(128)  NOT NULL,
  description     TEXT,
  capabilities    TEXT[],
  avatar_url      TEXT,
  accent_color    VARCHAR(16)   NOT NULL DEFAULT '#6366F1',
  status          agent_status  NOT NULL DEFAULT 'offline',
  openclaw_id     VARCHAR(256),
  last_seen_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agents_name ON agents (name);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents (status);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_agents_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER agents_updated_at
  BEFORE UPDATE ON agents
  FOR EACH ROW EXECUTE FUNCTION set_agents_updated_at();

ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_agents"
  ON agents FOR SELECT TO authenticated USING (true);

CREATE POLICY "service_write_agents"
  ON agents FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Seed: core FullThrottle agents
INSERT INTO agents (name, display_name, description, capabilities, avatar_url, accent_color, status)
VALUES
  (
    'clutch',
    'Clutch',
    'Chief of Staff. Receives requests, decomposes tasks, routes to specialist agents, and closes loops.',
    ARRAY['orchestration', 'routing', 'task-decomposition', 'slack'],
    NULL,
    '#6366F1',
    'offline'
  ),
  (
    'axel',
    'Axel',
    'Engineering agent. Implements features, fixes bugs, writes migrations, and opens PRs.',
    ARRAY['coding', 'debugging', 'migrations', 'refactoring', 'pr-creation'],
    '/agents/axel.png',
    '#14B8A6',
    'offline'
  ),
  (
    'riff',
    'Riff',
    'Product agent. Writes PRDs, user stories, acceptance criteria, and product specs.',
    ARRAY['product', 'requirements', 'user-stories', 'acceptance-criteria', 'scope'],
    '/agents/riff.png',
    '#F59E0B',
    'offline'
  ),
  (
    'arc',
    'ARC',
    'Architecture agent. Owns system design, API design, data models, gap checks, and implementation review.',
    ARRAY['architecture', 'system-design', 'api-design', 'data-modeling', 'review'],
    NULL,
    '#A78BFA',
    'offline'
  ),
  (
    'torque',
    'Torque',
    'QA agent. Writes test briefs, generates test cases, validates implementations, and assesses release readiness.',
    ARRAY['qa', 'test-cases', 'regression', 'validation', 'release-readiness'],
    '/agents/torque.png',
    '#F43F5E',
    'offline'
  )
ON CONFLICT (name) DO NOTHING;
