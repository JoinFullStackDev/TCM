-- S4: Add INSERT / UPDATE / DELETE RLS policies for the integrations table.
-- Permission: manage_integrations → SDET + Admin (mirrors application-level RBAC).

CREATE POLICY integrations_insert ON integrations
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('sdet', 'admin')
    )
  );

CREATE POLICY integrations_update ON integrations
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('sdet', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('sdet', 'admin')
    )
  );

CREATE POLICY integrations_delete ON integrations
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin')
    )
  );
