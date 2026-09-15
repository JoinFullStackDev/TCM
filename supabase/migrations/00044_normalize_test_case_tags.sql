-- 00044 — Canonicalize test_cases.tags so tag filtering is case-insensitive.
--
-- GET /api/test-cases now filters tags with Postgres array overlap (`&&`), which is
-- case-SENSITIVE. Rows written before this migration hold mixed-case tags ("Smoke",
-- "QA", "ToAutomate" alongside "happy-path"), so a query for "smoke" would miss them.
-- Writes are canonicalized from here on by tagsSchema (src/lib/validations/test-case.ts);
-- this backfills the rows that predate that rule.
--
-- Canonical form: trimmed, lowercased, empties dropped, de-duplicated, sorted.
-- NULL elements are dropped too (btrim(NULL) <> '' is NULL, not true).
--
-- Note: this is a display-visible change — a case shown with tag "Smoke" will read
-- "smoke" afterwards. The grid's tag facet list collapses to one entry per concept,
-- which is the point: "Smoke" and "smoke" are today two separate filter chips.

BEGIN;

-- test_cases carries two row triggers: trg_test_case_version (AFTER UPDATE, snapshots
-- into test_case_versions) and trg_test_cases_updated_at (BEFORE UPDATE, stamps now()).
-- A bulk normalization is not a user edit, so neither should fire: we do not want a
-- meaningless version bump in every affected case's history, nor every normalized row
-- jumping to the top of "recently updated".
--
-- session_replication_role is used rather than ALTER TABLE ... DISABLE TRIGGER because
-- it is SESSION-scoped and transaction-local:
--   * ALTER TABLE disables the trigger for every session, so a concurrent user edit
--     during the backfill would silently lose its version snapshot.
--   * ALTER TABLE takes SHARE ROW EXCLUSIVE on test_cases, which blocks all writes for
--     the duration; this takes only the ROW EXCLUSIVE that the UPDATE needs anyway.
--   * SET LOCAL reverts on COMMIT *or* ROLLBACK, so an aborted migration cannot leave
--     versioning switched off — with ALTER TABLE, a failed UPDATE would strand the
--     trigger disabled and silently stop recording history until someone noticed.
-- Requires the migration to run as a superuser/owner role, which is how Supabase
-- applies migrations.
SET LOCAL session_replication_role = replica;

UPDATE public.test_cases
   SET tags = ARRAY(
         SELECT DISTINCT lower(btrim(t))
           FROM unnest(tags) AS t
          WHERE btrim(t) <> ''
          ORDER BY 1
       )
 -- Only touch rows that actually differ, so untouched rows fire nothing at all and a
 -- re-run is a no-op (the migration is idempotent).
 WHERE tags <> ARRAY(
         SELECT DISTINCT lower(btrim(t))
           FROM unnest(tags) AS t
          WHERE btrim(t) <> ''
          ORDER BY 1
       );

COMMIT;

-- idx_test_cases_tags (GIN, from 00001) already covers the `&&` filter — no new index.
