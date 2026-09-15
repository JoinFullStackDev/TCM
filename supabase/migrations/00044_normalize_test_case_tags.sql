-- 00044 — Canonicalize test_cases.tags so tag filtering is case-insensitive.
--
-- GET /api/test-cases now filters tags with Postgres array overlap (`&&`), which is
-- case-SENSITIVE. Rows written before this migration hold mixed-case tags ("Smoke",
-- "QA", "ToAutomate" alongside "happy-path"), so a query for "smoke" would miss them.
-- Writes are canonicalized from here on by tagsSchema (src/lib/validations/test-case.ts);
-- this backfills the rows that predate that rule.
--
-- Canonical form: trimmed, lowercased, empties dropped, de-duplicated, sorted.
--
-- Note: this is a display-visible change — a case shown with tag "Smoke" will read
-- "smoke" afterwards. The grid's tag facet list collapses to one entry per concept,
-- which is the point: "Smoke" and "smoke" are today two separate filter chips.

-- The per-row AFTER UPDATE trigger snapshots a new test_case_versions row on every
-- update. A bulk normalization is not a user edit, so suppress it rather than writing
-- a meaningless version bump into every affected case's history.
ALTER TABLE public.test_cases DISABLE TRIGGER trg_test_case_version;

UPDATE public.test_cases
   SET tags = ARRAY(
         SELECT DISTINCT lower(btrim(t))
           FROM unnest(tags) AS t
          WHERE btrim(t) <> ''
          ORDER BY 1
       )
 -- Only touch rows that actually differ, so untouched rows fire nothing at all.
 WHERE tags <> ARRAY(
         SELECT DISTINCT lower(btrim(t))
           FROM unnest(tags) AS t
          WHERE btrim(t) <> ''
          ORDER BY 1
       );

ALTER TABLE public.test_cases ENABLE TRIGGER trg_test_case_version;

-- idx_test_cases_tags (GIN, from 00001) already covers the `&&` filter — no new index.
