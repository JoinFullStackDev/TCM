-- Add Scout to agent_name enum and agents registry
-- Scout is Clutch's background runner — no Slack presence, prepares staged output for Clutch to post.
-- Provisioned 2026-06-01.

ALTER TYPE agent_name ADD VALUE IF NOT EXISTS 'scout';

INSERT INTO agents (name, display_name, description, capabilities, avatar_url, accent_color, status)
VALUES (
  'scout',
  'Scout',
  'Background runner for Clutch. No Slack presence. Handles all mechanical cron work: repo syncs, Granola sync, daily log creation, QA cadence message prep, and FullStackRX digest prep. Stages output to scout-queue/ for Clutch to pick up and post.',
  ARRAY['repo-sync', 'digest-prep', 'qa-cadence', 'file-operations', 'background-runner'],
  NULL,
  '#558B2F',
  'offline'
)
ON CONFLICT (name) DO NOTHING;
