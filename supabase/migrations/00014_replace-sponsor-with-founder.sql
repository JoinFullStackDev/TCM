-- Migration 00014: Replace "sponsor" with "founder" in test case content
-- Preserves case: Sponsor→Founder, sponsor→founder, SPONSOR→FOUNDER

UPDATE test_cases
SET
  description = regexp_replace(
    regexp_replace(
      regexp_replace(description, 'SPONSOR', 'FOUNDER', 'g'),
      'Sponsor', 'Founder', 'g'
    ),
    'sponsor', 'founder', 'g'
  ),
  preconditions = regexp_replace(
    regexp_replace(
      regexp_replace(preconditions, 'SPONSOR', 'FOUNDER', 'g'),
      'Sponsor', 'Founder', 'g'
    ),
    'sponsor', 'founder', 'g'
  ),
  steps = regexp_replace(
    regexp_replace(
      regexp_replace(steps, 'SPONSOR', 'FOUNDER', 'g'),
      'Sponsor', 'Founder', 'g'
    ),
    'sponsor', 'founder', 'g'
  )
WHERE
  description    ILIKE '%sponsor%'
  OR preconditions ILIKE '%sponsor%'
  OR steps         ILIKE '%sponsor%';
