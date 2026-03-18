-- =============================================================================
-- Note–Test Case Links Migration
-- Junction table linking notes to test cases
-- =============================================================================

CREATE TABLE note_test_case_links (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id      uuid NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  test_case_id uuid NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(note_id, test_case_id)
);

CREATE INDEX idx_note_tc_links_note_id ON note_test_case_links(note_id);
CREATE INDEX idx_note_tc_links_tc_id   ON note_test_case_links(test_case_id);

ALTER TABLE note_test_case_links ENABLE ROW LEVEL SECURITY;

-- SELECT: visible if the linked note is visible (own or team)
CREATE POLICY "note_tc_links_select" ON note_test_case_links
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = note_test_case_links.note_id
        AND (notes.author_id = auth.uid() OR notes.visibility = 'team')
    )
  );

-- INSERT: only the note author
CREATE POLICY "note_tc_links_insert" ON note_test_case_links
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = note_test_case_links.note_id
        AND notes.author_id = auth.uid()
    )
  );

-- DELETE: only the note author
CREATE POLICY "note_tc_links_delete" ON note_test_case_links
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = note_test_case_links.note_id
        AND notes.author_id = auth.uid()
    )
  );
