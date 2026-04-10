-- Migration: add actual_data_used field to execution_results
-- Allows testers to record the actual test data value used during a step execution.
-- Scoped to (test_run_id, test_step_id, platform, browser) -- never touches test_steps.
ALTER TABLE execution_results
  ADD COLUMN IF NOT EXISTS actual_data_used text DEFAULT NULL;
