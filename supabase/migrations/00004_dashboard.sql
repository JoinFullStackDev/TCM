-- =============================================================================
-- Dashboard: preferences table + aggregated summary RPC
-- =============================================================================

-- dashboard_preferences ---------------------------------------------------
CREATE TABLE dashboard_preferences (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  card_config jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

CREATE TRIGGER trg_dashboard_preferences_updated_at
  BEFORE UPDATE ON dashboard_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE dashboard_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dashboard_prefs_select" ON dashboard_preferences
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "dashboard_prefs_insert" ON dashboard_preferences
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "dashboard_prefs_update" ON dashboard_preferences
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "dashboard_prefs_delete" ON dashboard_preferences
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- dashboard_summary RPC
-- Single round-trip aggregation for the dashboard page.
-- Returns { user_section, global_section, admin_section (null for non-admin) }
-- Uses SECURITY DEFINER so it can read across all tables regardless of RLS.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION dashboard_summary(p_user_id uuid, p_role text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user    jsonb;
  v_global  jsonb;
  v_admin   jsonb;
  v_now     timestamptz := now();
BEGIN
  -- ===================== USER SECTION =====================

  -- My assigned runs (planned or in_progress, max 10)
  SELECT COALESCE(jsonb_agg(r ORDER BY r.created_at DESC), '[]'::jsonb)
  INTO v_user
  FROM (
    SELECT
      tr.id,
      tr.name,
      tr.status::text AS status,
      tr.created_at,
      p.name AS project_name,
      (SELECT count(*)::int FROM test_run_cases trc WHERE trc.test_run_id = tr.id) AS total_cases,
      (SELECT count(*)::int FROM test_run_cases trc WHERE trc.test_run_id = tr.id AND trc.overall_status != 'not_run') AS executed_cases
    FROM test_runs tr
    JOIN projects p ON p.id = tr.project_id
    WHERE tr.assignee_id = p_user_id
      AND tr.status IN ('planned', 'in_progress')
    ORDER BY tr.created_at DESC
    LIMIT 10
  ) r;

  v_user := jsonb_build_object('my_assigned_runs', v_user);

  -- My recent activity (last 10 execution results)
  v_user := v_user || jsonb_build_object('my_recent_activity', (
    SELECT COALESCE(jsonb_agg(a ORDER BY a.executed_at DESC NULLS LAST), '[]'::jsonb)
    FROM (
      SELECT
        er.id,
        er.status::text AS status,
        er.platform::text AS platform,
        er.executed_at,
        tc.display_id,
        tc.title AS test_case_title,
        tr.name AS run_name,
        tr.id AS test_run_id
      FROM execution_results er
      JOIN test_cases tc ON tc.id = er.test_case_id
      JOIN test_runs tr ON tr.id = er.test_run_id
      WHERE er.executed_by = p_user_id
      ORDER BY er.executed_at DESC NULLS LAST
      LIMIT 10
    ) a
  ));

  -- My stats (executions this week, this month, pass rate 30d)
  v_user := v_user || jsonb_build_object('my_stats', (
    SELECT jsonb_build_object(
      'executions_this_week', (
        SELECT count(*)::int FROM execution_results
        WHERE executed_by = p_user_id
          AND executed_at >= date_trunc('week', v_now)
      ),
      'executions_this_month', (
        SELECT count(*)::int FROM execution_results
        WHERE executed_by = p_user_id
          AND executed_at >= date_trunc('month', v_now)
      ),
      'pass_rate_30d', (
        SELECT CASE WHEN count(*) > 0
          THEN round(count(*) FILTER (WHERE status = 'pass')::numeric / count(*)::numeric * 100)
          ELSE 0
        END::int
        FROM execution_results
        WHERE executed_by = p_user_id
          AND status != 'not_run'
          AND executed_at >= v_now - interval '30 days'
      ),
      'total_executed_30d', (
        SELECT count(*)::int FROM execution_results
        WHERE executed_by = p_user_id
          AND status != 'not_run'
          AND executed_at >= v_now - interval '30 days'
      )
    )
  ));

  -- ===================== GLOBAL SECTION =====================

  -- Active projects with counts (max 20)
  v_global := jsonb_build_object('active_projects', (
    SELECT COALESCE(jsonb_agg(proj ORDER BY proj.created_at DESC), '[]'::jsonb)
    FROM (
      SELECT
        p.id,
        p.name,
        p.description,
        p.created_at,
        (SELECT count(*)::int FROM suites s WHERE s.project_id = p.id) AS suite_count,
        (SELECT count(*)::int FROM test_cases tc JOIN suites s ON s.id = tc.suite_id WHERE s.project_id = p.id) AS test_case_count
      FROM projects p
      WHERE p.is_archived = false
      ORDER BY p.created_at DESC
      LIMIT 20
    ) proj
  ));

  -- Run overview: count by status
  v_global := v_global || jsonb_build_object('run_overview', (
    SELECT jsonb_build_object(
      'planned',     count(*) FILTER (WHERE status = 'planned')::int,
      'in_progress', count(*) FILTER (WHERE status = 'in_progress')::int,
      'completed',   count(*) FILTER (WHERE status = 'completed')::int,
      'aborted',     count(*) FILTER (WHERE status = 'aborted')::int
    )
    FROM test_runs
  ));

  -- Recent runs (last 5)
  v_global := v_global || jsonb_build_object('recent_runs', (
    SELECT COALESCE(jsonb_agg(r ORDER BY r.created_at DESC), '[]'::jsonb)
    FROM (
      SELECT
        tr.id,
        tr.name,
        tr.status::text AS status,
        tr.created_at,
        p.name AS project_name
      FROM test_runs tr
      JOIN projects p ON p.id = tr.project_id
      ORDER BY tr.created_at DESC
      LIMIT 5
    ) r
  ));

  -- Pass rate summary (completed runs, last 30d)
  v_global := v_global || jsonb_build_object('pass_rate_summary', (
    SELECT jsonb_build_object(
      'pass_rate', CASE WHEN count(*) > 0
        THEN round(count(*) FILTER (WHERE trc.overall_status = 'pass')::numeric / count(*)::numeric * 100)
        ELSE 0
      END::int,
      'total_cases', count(*)::int,
      'passed', count(*) FILTER (WHERE trc.overall_status = 'pass')::int,
      'failed', count(*) FILTER (WHERE trc.overall_status = 'fail')::int,
      'completed_runs', (
        SELECT count(*)::int FROM test_runs
        WHERE status = 'completed' AND completed_at >= v_now - interval '30 days'
      )
    )
    FROM test_run_cases trc
    JOIN test_runs tr ON tr.id = trc.test_run_id
    WHERE tr.status = 'completed'
      AND tr.completed_at >= v_now - interval '30 days'
  ));

  -- Platform coverage
  v_global := v_global || jsonb_build_object('platform_coverage', (
    SELECT COALESCE(jsonb_agg(pc), '[]'::jsonb)
    FROM (
      SELECT
        er.platform::text AS platform,
        count(*)::int AS total,
        count(*) FILTER (WHERE er.status = 'pass')::int AS pass,
        count(*) FILTER (WHERE er.status = 'fail')::int AS fail,
        CASE WHEN count(*) > 0
          THEN round(count(*) FILTER (WHERE er.status = 'pass')::numeric / count(*)::numeric * 100)
          ELSE 0
        END::int AS pass_rate
      FROM execution_results er
      WHERE er.status != 'not_run'
      GROUP BY er.platform
    ) pc
  ));

  -- ===================== ADMIN SECTION (null for non-admin) =====================

  IF p_role = 'admin' THEN
    -- User activity
    v_admin := jsonb_build_object('user_activity', (
      SELECT COALESCE(jsonb_agg(u ORDER BY u.last_active_at DESC NULLS LAST), '[]'::jsonb)
      FROM (
        SELECT
          pr.id,
          pr.email,
          pr.full_name,
          pr.avatar_url,
          pr.role::text AS role,
          pr.is_active,
          pr.last_active_at
        FROM profiles pr
        ORDER BY pr.last_active_at DESC NULLS LAST
      ) u
    ));

    -- Pending invitations
    v_admin := v_admin || jsonb_build_object('pending_invitations', (
      SELECT COALESCE(jsonb_agg(i ORDER BY i.expires_at ASC), '[]'::jsonb)
      FROM (
        SELECT
          inv.id,
          inv.email,
          inv.role::text AS role,
          inv.expires_at,
          inv.created_at
        FROM invitations inv
        WHERE inv.status = 'pending'
        ORDER BY inv.expires_at ASC
      ) i
    ));

    -- System stats
    v_admin := v_admin || jsonb_build_object('system_stats', (
      SELECT jsonb_build_object(
        'users',       (SELECT count(*)::int FROM profiles),
        'projects',    (SELECT count(*)::int FROM projects WHERE is_archived = false),
        'suites',      (SELECT count(*)::int FROM suites),
        'test_cases',  (SELECT count(*)::int FROM test_cases),
        'test_runs',   (SELECT count(*)::int FROM test_runs),
        'executions',  (SELECT count(*)::int FROM execution_results WHERE status != 'not_run')
      )
    ));

    -- Webhook health (last 7 days)
    v_admin := v_admin || jsonb_build_object('webhook_health', (
      SELECT jsonb_build_object(
        'success', count(*) FILTER (WHERE status = 'success')::int,
        'failed',  count(*) FILTER (WHERE status = 'failed')::int,
        'pending', count(*) FILTER (WHERE status = 'pending')::int,
        'processing', count(*) FILTER (WHERE status = 'processing')::int,
        'total',   count(*)::int
      )
      FROM webhook_events
      WHERE created_at >= v_now - interval '7 days'
    ));

    -- Import activity (last 10)
    v_admin := v_admin || jsonb_build_object('import_activity', (
      SELECT COALESCE(jsonb_agg(imp ORDER BY imp.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT
          ci.id,
          ci.file_name,
          ci.status::text AS status,
          ci.imported_count,
          ci.skipped_count,
          ci.error_count,
          ci.total_rows,
          ci.created_at,
          p.name AS project_name
        FROM csv_imports ci
        JOIN projects p ON p.id = ci.project_id
        ORDER BY ci.created_at DESC
        LIMIT 10
      ) imp
    ));
  END IF;

  RETURN jsonb_build_object(
    'user_section',   v_user,
    'global_section', v_global,
    'admin_section',  v_admin
  );
END;
$$;
