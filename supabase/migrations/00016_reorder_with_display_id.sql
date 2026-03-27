-- Migration: Extend reorder_test_cases to renumber display_id for pure non-CICD suites
-- ============================================================
-- Replaces the existing reorder_test_cases function with a version that:
--
--   Scenario A — ANY active test case in the suite has automation_status = 'in_cicd':
--     Updates position only (no display_id or sequence_number changes). IDs are
--     locked to prevent breaking CI/CD pipeline references.
--
--   Scenario B — NO active test case has automation_status = 'in_cicd':
--     1. Updates position = ordinal for all tests in the ordered array.
--     2. First pass: sets display_id to a temp value (__tmp__<id>) to avoid
--        the non-deferrable UNIQUE constraint firing during renumbering.
--     3. Second pass: sets display_id = prefix || '-' || ordinal and
--        sequence_number = ordinal for each test in the ordered array.
--     4. Updates suites.next_sequence = array_length(p_ordered_ids, 1) + 1.
--
--   Always: increments suites.reorder_version and returns its new value.

CREATE OR REPLACE FUNCTION reorder_test_cases(
  p_suite_id    uuid,
  p_ordered_ids uuid[]
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_new_version  integer;
  v_has_cicd     boolean;
  v_suite_prefix text;
BEGIN
  -- Check if any active test case in this suite is in_cicd
  SELECT EXISTS (
    SELECT 1
      FROM test_cases
     WHERE suite_id         = p_suite_id
       AND deleted_at       IS NULL
       AND automation_status = 'in_cicd'
  ) INTO v_has_cicd;

  -- Always: assign 1-based positions from the ordered array in a single UPDATE
  UPDATE test_cases tc
     SET position = ord.ordinal
    FROM unnest(p_ordered_ids) WITH ORDINALITY AS ord(id, ordinal)
   WHERE tc.id       = ord.id
     AND tc.suite_id = p_suite_id
     AND tc.deleted_at IS NULL;

  IF NOT v_has_cicd THEN
    -- Fetch the suite prefix for display_id construction
    SELECT prefix INTO v_suite_prefix
      FROM suites
     WHERE id = p_suite_id;

    -- First pass: stamp temp display_ids to clear the way for renumbering
    -- (display_id has a non-deferrable UNIQUE constraint)
    UPDATE test_cases tc
       SET display_id = '__tmp__' || tc.id::text
      FROM unnest(p_ordered_ids) WITH ORDINALITY AS ord(id, ordinal)
     WHERE tc.id       = ord.id
       AND tc.suite_id = p_suite_id
       AND tc.deleted_at IS NULL;

    -- Second pass: assign final display_id and sequence_number based on new ordinal
    UPDATE test_cases tc
       SET display_id      = v_suite_prefix || '-' || ord.ordinal,
           sequence_number = ord.ordinal
      FROM unnest(p_ordered_ids) WITH ORDINALITY AS ord(id, ordinal)
     WHERE tc.id       = ord.id
       AND tc.suite_id = p_suite_id
       AND tc.deleted_at IS NULL;

    -- Keep next_sequence one ahead of the highest assigned ordinal
    UPDATE suites
       SET next_sequence = array_length(p_ordered_ids, 1) + 1
     WHERE id = p_suite_id;
  END IF;

  -- Increment reorder_version and capture the new value
  UPDATE suites
     SET reorder_version = reorder_version + 1
   WHERE id = p_suite_id
  RETURNING reorder_version INTO v_new_version;

  RETURN COALESCE(v_new_version, 0);
END;
$$;
