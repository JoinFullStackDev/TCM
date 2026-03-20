-- Migration: allow created_by to be NULL on test_runs for webhook/CI-automated runs
--
-- Root cause: the playwright webhook inserts test_runs with
-- created_by = '00000000-0000-0000-0000-000000000000' (nil UUID) which
-- violates the FK constraint to profiles(id) and silently fails the insert.
-- Automated runs have no human author; NULL is the correct representation.

ALTER TABLE test_runs
  ALTER COLUMN created_by DROP NOT NULL;
