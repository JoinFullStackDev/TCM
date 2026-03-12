-- Allow qa_engineer and sdet to delete test_steps and bug_links,
-- matching their INSERT/UPDATE policies. Previously only admin could
-- delete, which silently broke CSV import "Update existing" for
-- non-admin users (RLS filtered the DELETE to 0 rows, then the
-- subsequent INSERT hit a UNIQUE constraint on step_number).

DROP POLICY IF EXISTS "test_steps_delete" ON test_steps;
CREATE POLICY "test_steps_delete" ON test_steps
  FOR DELETE TO authenticated
  USING (auth_role() IN ('admin', 'qa_engineer', 'sdet'));

DROP POLICY IF EXISTS "bug_links_delete" ON bug_links;
CREATE POLICY "bug_links_delete" ON bug_links
  FOR DELETE TO authenticated
  USING (auth_role() IN ('admin', 'qa_engineer', 'sdet'));
