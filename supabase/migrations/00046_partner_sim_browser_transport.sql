-- Migration 00046: Partner API simulator: per-partner base URL, transport and key age
--
-- QA runs TCM in the same browser they test FullStackRx with. QA's FullStackRx is only
-- reachable on the VPN, so TCM's server (Vercel) can't call it; the tester's browser
-- makes the call instead and TCM records the result. Staging is public, so TCM's server
-- can call it directly.
--
--   api_base_url   the FullStackRx API base QA typed in (no trailing /v1)
--   call_mode      'browser': the tester's browser calls FullStackRx (VPN-only QA)
--                  'server':  TCM's server calls FullStackRx (public environments)
--   api_key_set_at when the current API key was saved, for the "swap your key" reminder
--
-- The 'local' environment is retired: QA only targets QA or staging ('other' covers
-- anything else, such as a developer's machine).

ALTER TABLE partner_sim_partners
  ADD COLUMN api_base_url text,
  ADD COLUMN call_mode text NOT NULL DEFAULT 'browser',
  ADD COLUMN api_key_set_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE partner_sim_partners
  ADD CONSTRAINT partner_sim_partners_call_mode_check CHECK (call_mode IN ('browser', 'server'));

UPDATE partner_sim_partners SET environment = 'other' WHERE environment = 'local';
ALTER TABLE partner_sim_partners DROP CONSTRAINT IF EXISTS partner_sim_partners_environment_check;
ALTER TABLE partner_sim_partners
  ADD CONSTRAINT partner_sim_partners_environment_check CHECK (environment IN ('qa', 'staging', 'other'));

UPDATE partner_sim_partners SET api_key_set_at = updated_at;
