-- Migration: add optional comment field to execution_results
-- Allows testers to record a note when marking a step Pass/Fail/Skip/Blocked.
ALTER TABLE execution_results
  ADD COLUMN IF NOT EXISTS comment text DEFAULT NULL;
