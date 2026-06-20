-- Add is_hidden flag to test_runs for soft-hiding old/messy runs
ALTER TABLE test_runs ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;

-- Hide all test runs created before June 18, 2026 (UTC)
UPDATE test_runs
SET is_hidden = true
WHERE created_at < '2026-06-18T00:00:00Z';
