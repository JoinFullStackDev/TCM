-- =============================================================================
-- Notes Feature Migration
-- User notes with team sharing, attachments, and AI summaries
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enum
-- ---------------------------------------------------------------------------
CREATE TYPE note_visibility AS ENUM ('private', 'team');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE notes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title         text,
  content       text NOT NULL DEFAULT '',
  content_plain text,
  summary       text,
  visibility    note_visibility NOT NULL DEFAULT 'private',
  meeting_url   text,
  is_pinned     boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE note_attachments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id       uuid NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  storage_path  text NOT NULL,
  file_name     text NOT NULL,
  file_size     bigint,
  mime_type     text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX idx_notes_author_id ON notes(author_id);
CREATE INDEX idx_notes_visibility ON notes(visibility);
CREATE INDEX idx_notes_created_at ON notes(created_at DESC);
CREATE INDEX idx_notes_author_pinned ON notes(author_id, is_pinned DESC, updated_at DESC);
CREATE INDEX idx_note_attachments_note_id ON note_attachments(note_id);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
CREATE TRIGGER set_notes_updated_at
  BEFORE UPDATE ON notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_attachments ENABLE ROW LEVEL SECURITY;

-- Notes: author sees own, all authenticated see team-visible
CREATE POLICY "notes_select" ON notes
  FOR SELECT TO authenticated
  USING (
    author_id = auth.uid()
    OR visibility = 'team'
  );

CREATE POLICY "notes_insert" ON notes
  FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "notes_update" ON notes
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "notes_delete" ON notes
  FOR DELETE TO authenticated
  USING (author_id = auth.uid());

-- Note attachments: inherit access from parent note
CREATE POLICY "note_attachments_select" ON note_attachments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = note_attachments.note_id
        AND (notes.author_id = auth.uid() OR notes.visibility = 'team')
    )
  );

CREATE POLICY "note_attachments_insert" ON note_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = note_attachments.note_id
        AND notes.author_id = auth.uid()
    )
  );

CREATE POLICY "note_attachments_delete" ON note_attachments
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = note_attachments.note_id
        AND notes.author_id = auth.uid()
    )
  );
