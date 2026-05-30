-- Migration: 00033_docs.sql
-- Global Docs section: doc_folders and docs tables, indexes, triggers, RLS

-- ============================================================
-- 1. doc_folders table
-- ============================================================

CREATE TABLE doc_folders (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 255),
  parent_id   uuid        REFERENCES doc_folders(id) ON DELETE CASCADE,
  project_id  uuid        REFERENCES projects(id) ON DELETE SET NULL,
  position    integer     NOT NULL DEFAULT 0,
  created_by  uuid        NOT NULL REFERENCES profiles(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX doc_folders_parent_id_idx  ON doc_folders (parent_id);
CREATE INDEX doc_folders_project_id_idx ON doc_folders (project_id);
CREATE INDEX doc_folders_position_idx   ON doc_folders (position);

-- updated_at trigger (conditional moddatetime pattern)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'moddatetime') THEN
    EXECUTE $SQL$
      CREATE TRIGGER set_doc_folders_updated_at
        BEFORE UPDATE ON doc_folders
        FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);
    $SQL$;
  ELSE
    EXECUTE $SQL$
      CREATE OR REPLACE FUNCTION _doc_folders_set_updated_at()
      RETURNS TRIGGER AS $TRG$
      BEGIN NEW.updated_at = now(); RETURN NEW; END;
      $TRG$ LANGUAGE plpgsql;
      CREATE TRIGGER set_doc_folders_updated_at
        BEFORE UPDATE ON doc_folders
        FOR EACH ROW EXECUTE FUNCTION _doc_folders_set_updated_at();
    $SQL$;
  END IF;
END;
$$;

-- ============================================================
-- 2. docs table
-- ============================================================

CREATE TABLE docs (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text        NOT NULL DEFAULT 'Untitled Document'
                            CHECK (char_length(title) BETWEEN 1 AND 500),
  content       text,
  folder_id     uuid        REFERENCES doc_folders(id) ON DELETE SET NULL,
  project_id    uuid        REFERENCES projects(id) ON DELETE SET NULL,
  created_by    uuid        NOT NULL REFERENCES profiles(id),
  updated_by    uuid        REFERENCES profiles(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  search_vector tsvector    GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, ''))
  ) STORED
);

CREATE INDEX docs_folder_id_idx     ON docs (folder_id);
CREATE INDEX docs_project_id_idx    ON docs (project_id);
CREATE INDEX docs_updated_at_idx    ON docs (updated_at DESC);
CREATE INDEX docs_search_vector_idx ON docs USING GIN (search_vector);

-- updated_at trigger (same conditional moddatetime pattern)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'moddatetime') THEN
    EXECUTE $SQL$
      CREATE TRIGGER set_docs_updated_at
        BEFORE UPDATE ON docs
        FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);
    $SQL$;
  ELSE
    EXECUTE $SQL$
      CREATE OR REPLACE FUNCTION _docs_set_updated_at()
      RETURNS TRIGGER AS $TRG$
      BEGIN NEW.updated_at = now(); RETURN NEW; END;
      $TRG$ LANGUAGE plpgsql;
      CREATE TRIGGER set_docs_updated_at
        BEFORE UPDATE ON docs
        FOR EACH ROW EXECUTE FUNCTION _docs_set_updated_at();
    $SQL$;
  END IF;
END;
$$;

-- ============================================================
-- 3. RLS Policies — doc_folders
-- ============================================================

ALTER TABLE doc_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY doc_folders_select ON doc_folders FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY doc_folders_insert ON doc_folders FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
    AND profiles.role::text IN ('admin', 'sdet', 'qa_engineer')
  ));

CREATE POLICY doc_folders_update ON doc_folders FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
    AND profiles.role::text IN ('admin', 'sdet')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
    AND profiles.role::text IN ('admin', 'sdet')
  ));

CREATE POLICY doc_folders_delete ON doc_folders FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
    AND profiles.role::text IN ('admin', 'sdet')
  ));

-- ============================================================
-- 4. RLS Policies — docs
-- ============================================================

ALTER TABLE docs ENABLE ROW LEVEL SECURITY;

CREATE POLICY docs_select ON docs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY docs_insert ON docs FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
    AND profiles.role::text IN ('admin', 'sdet', 'qa_engineer')
  ));

CREATE POLICY docs_update ON docs FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
    AND profiles.role::text IN ('admin', 'sdet', 'qa_engineer')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
    AND profiles.role::text IN ('admin', 'sdet', 'qa_engineer')
  ));

CREATE POLICY docs_delete ON docs FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
    AND profiles.role::text IN ('admin', 'sdet')
  ));
