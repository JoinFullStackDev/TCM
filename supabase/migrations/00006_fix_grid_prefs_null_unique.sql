-- Fix: UNIQUE(user_id, project_id, suite_id) does not prevent duplicates
-- when suite_id IS NULL because PostgreSQL treats NULL != NULL for uniqueness.
-- Replace with two partial unique indexes that handle both cases correctly.

BEGIN;

-- Deduplicate existing rows where suite_id IS NULL, keeping the most recent
DELETE FROM grid_column_preferences a
USING grid_column_preferences b
WHERE a.suite_id IS NULL AND b.suite_id IS NULL
  AND a.user_id = b.user_id AND a.project_id = b.project_id
  AND a.updated_at < b.updated_at;

-- Drop the old constraint that doesn't handle NULLs
ALTER TABLE grid_column_preferences
  DROP CONSTRAINT grid_column_preferences_user_id_project_id_suite_id_key;

-- Enforce uniqueness for rows WITH a suite_id
CREATE UNIQUE INDEX grid_prefs_unique_with_suite
  ON grid_column_preferences(user_id, project_id, suite_id)
  WHERE suite_id IS NOT NULL;

-- Enforce uniqueness for rows WITHOUT a suite_id (one per user+project)
CREATE UNIQUE INDEX grid_prefs_unique_without_suite
  ON grid_column_preferences(user_id, project_id)
  WHERE suite_id IS NULL;

COMMIT;
