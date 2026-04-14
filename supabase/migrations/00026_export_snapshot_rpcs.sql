-- RPC functions for consistent point-in-time export snapshots
-- Uses REPEATABLE READ isolation to guarantee snapshot consistency (TF-EXP-25)

CREATE OR REPLACE FUNCTION export_project_snapshot(p_project_id uuid)
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  -- All reads within this function share a single snapshot
  PERFORM set_config('transaction_isolation', 'repeatable read', true);

  SELECT json_build_object(
    'suites', (
      SELECT json_agg(suite_data ORDER BY suite_data_position)
      FROM (
        SELECT
          s.position AS suite_data_position,
          json_build_object(
            'id', s.id,
            'name', s.name,
            'position', s.position,
            'color_index', s.color_index,
            'prefix', s.prefix,
            'test_cases', (
              SELECT json_agg(tc_data ORDER BY tc_data_position)
              FROM (
                SELECT
                  tc.position AS tc_data_position,
                  json_build_object(
                    'id', tc.id,
                    'display_id', tc.display_id,
                    'title', tc.title,
                    'description', tc.description,
                    'precondition', tc.precondition,
                    'position', tc.position,
                    'automation_status', tc.automation_status,
                    'steps', (
                      SELECT json_agg(ts ORDER BY ts.step_number)
                      FROM test_steps ts
                      WHERE ts.test_case_id = tc.id
                    ),
                    'bug_links', (
                      SELECT json_agg(bl)
                      FROM bug_links bl
                      WHERE bl.test_case_id = tc.id
                    )
                  ) AS tc_data
                FROM test_cases tc
                WHERE tc.suite_id = s.id
                  AND tc.deleted_at IS NULL
              ) tc_rows
            )
          ) AS suite_data
        FROM suites s
        WHERE s.project_id = p_project_id
      ) suite_rows
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION export_suite_snapshot(p_suite_id uuid)
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  PERFORM set_config('transaction_isolation', 'repeatable read', true);

  SELECT json_build_object(
    'suites', json_build_array(
      json_build_object(
        'id', s.id,
        'name', s.name,
        'position', s.position,
        'color_index', s.color_index,
        'prefix', s.prefix,
        'test_cases', (
          SELECT json_agg(tc_data ORDER BY tc_data_position)
          FROM (
            SELECT
              tc.position AS tc_data_position,
              json_build_object(
                'id', tc.id,
                'display_id', tc.display_id,
                'title', tc.title,
                'description', tc.description,
                'precondition', tc.precondition,
                'position', tc.position,
                'automation_status', tc.automation_status,
                'steps', (
                  SELECT json_agg(ts ORDER BY ts.step_number)
                  FROM test_steps ts
                  WHERE ts.test_case_id = tc.id
                ),
                'bug_links', (
                  SELECT json_agg(bl)
                  FROM bug_links bl
                  WHERE bl.test_case_id = tc.id
                )
              ) AS tc_data
            FROM test_cases tc
            WHERE tc.suite_id = s.id
              AND tc.deleted_at IS NULL
          ) tc_rows
        )
      )
    )
  )
  INTO result
  FROM suites s
  WHERE s.id = p_suite_id;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;
