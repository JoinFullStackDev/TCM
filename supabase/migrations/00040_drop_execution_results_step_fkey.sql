-- Migration: 00040_drop_execution_results_step_fkey
--
-- Problem: execution_results.test_step_id has a hard FK to test_steps(id).
-- Runs snapshot step data into test_run_cases.snapshot_steps at creation time.
-- If a step is later deleted from test_steps, saving an execution result for
-- that step fails with a FK constraint violation (500 error in the UI).
--
-- Fix: Drop the FK. test_step_id is a logical reference — the snapshot is the
-- authoritative source of step identity within a run. Live test_steps should
-- not gate execution result writes.
--
-- The existing ON DELETE CASCADE behavior (cascading deletes from test_steps)
-- is also removed. Historical run results are preserved regardless of step
-- lifecycle in the live table.

ALTER TABLE execution_results
  DROP CONSTRAINT IF EXISTS execution_results_test_step_id_fkey;
