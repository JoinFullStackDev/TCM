-- =============================================================================
-- merge_suites: atomically move all test cases from source into target suite,
-- re-sequence display IDs, then delete the source suite.
-- =============================================================================

CREATE OR REPLACE FUNCTION merge_suites(p_source_suite_id uuid, p_target_suite_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source_project uuid;
  v_target_project uuid;
  v_target_prefix  text;
  v_next_seq       integer;
  v_moved          integer;
BEGIN
  -- Validate source suite exists
  SELECT project_id INTO v_source_project
  FROM suites WHERE id = p_source_suite_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source suite not found';
  END IF;

  -- Lock target suite and read its state
  SELECT project_id, prefix, next_sequence
  INTO v_target_project, v_target_prefix, v_next_seq
  FROM suites WHERE id = p_target_suite_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target suite not found';
  END IF;

  -- Both must belong to the same project
  IF v_source_project != v_target_project THEN
    RAISE EXCEPTION 'Suites must belong to the same project';
  END IF;

  -- Count cases to move
  SELECT count(*)::int INTO v_moved
  FROM test_cases WHERE suite_id = p_source_suite_id;

  IF v_moved > 0 THEN
    -- Reassign test cases: new suite, new sequence numbers, new display IDs
    WITH ranked AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY sequence_number) AS rn
      FROM test_cases WHERE suite_id = p_source_suite_id
    )
    UPDATE test_cases tc
    SET suite_id        = p_target_suite_id,
        sequence_number = v_next_seq + r.rn::int - 1,
        display_id      = v_target_prefix || '-' || (v_next_seq + r.rn::int - 1),
        updated_at      = now()
    FROM ranked r
    WHERE tc.id = r.id;

    -- Bump target's next_sequence
    UPDATE suites
    SET next_sequence = next_sequence + v_moved
    WHERE id = p_target_suite_id;
  END IF;

  -- Delete the now-empty source suite
  DELETE FROM suites WHERE id = p_source_suite_id;

  RETURN jsonb_build_object(
    'moved_count',     v_moved,
    'target_suite_id', p_target_suite_id,
    'target_prefix',   v_target_prefix
  );
END;
$$;
