-- Migration 00032: Fix suite sequence drift + harden generate_test_case_id
-- =========================================================================
-- Root cause:
--   suites.next_sequence falls out of sync when test cases are inserted via
--   bulk import (CSV), restore-from-trash, or any path that writes
--   sequence_number directly without going through generate_test_case_id.
--   The result is a duplicate display_id collision on the next manual create,
--   which surfaces as:
--     "duplicate key value violates unique constraint test_cases_display_id_key"
--
-- Fix part 1 (immediate repair):
--   Reset next_sequence for every suite where it is behind
--   MAX(sequence_number) + 1 across its active test cases.
--
-- Fix part 2 (defensive guard):
--   Rewrite generate_test_case_id to skip forward past any display_id that
--   already exists (active or soft-deleted), so a stale sequence can never
--   produce a duplicate again.

-- ── Part 1: one-time repair ───────────────────────────────────────────────
UPDATE suites s
SET    next_sequence = sub.max_seq + 1
FROM (
  SELECT suite_id,
         MAX(sequence_number) AS max_seq
    FROM test_cases
   WHERE deleted_at IS NULL
   GROUP BY suite_id
) sub
WHERE s.id            = sub.suite_id
  AND s.next_sequence <= sub.max_seq;

-- ── Part 2: harden generate_test_case_id ─────────────────────────────────
CREATE OR REPLACE FUNCTION generate_test_case_id(p_suite_id uuid)
RETURNS TABLE(display_id text, sequence_number integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix text;
  v_seq    integer;
  v_did    text;
BEGIN
  -- Lock the suite row to serialise concurrent inserts
  SELECT s.prefix, s.next_sequence
    INTO v_prefix, v_seq
    FROM suites s
   WHERE s.id = p_suite_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Suite % not found', p_suite_id;
  END IF;

  -- Skip forward past any sequence number whose display_id already exists
  -- (covers both active and soft-deleted cases to avoid future collisions).
  LOOP
    v_did := v_prefix || '-' || v_seq;
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM test_cases
       WHERE suite_id  = p_suite_id
         AND display_id = v_did
    );
    v_seq := v_seq + 1;
  END LOOP;

  -- Advance the cursor past the one we're about to hand out
  UPDATE suites SET next_sequence = v_seq + 1 WHERE id = p_suite_id;

  display_id      := v_did;
  sequence_number := v_seq;
  RETURN NEXT;
END;
$$;
