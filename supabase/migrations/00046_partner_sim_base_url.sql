-- Migration 00046: Partner API simulator: per-partner API base URL and key age
--
-- QA tests the Partner API on staging (public; QA's FullStackRx is VPN-only and TCM's
-- server can't reach it). Each partner now carries its own base URL, typed in by QA, and
-- the time its current key was saved, for the "swap your key" reminder.
--
--   api_base_url    the FullStackRx API base (no trailing /v1)
--   api_key_set_at  when the current API key was saved
--
-- The 'local' environment is retired; 'other' covers anything that isn't QA or staging.

ALTER TABLE partner_sim_partners
  ADD COLUMN api_base_url text,
  ADD COLUMN api_key_set_at timestamptz NOT NULL DEFAULT now();

UPDATE partner_sim_partners SET environment = 'other' WHERE environment = 'local';
ALTER TABLE partner_sim_partners DROP CONSTRAINT IF EXISTS partner_sim_partners_environment_check;
ALTER TABLE partner_sim_partners
  ADD CONSTRAINT partner_sim_partners_environment_check CHECK (environment IN ('qa', 'staging', 'other'));

UPDATE partner_sim_partners SET api_key_set_at = updated_at;
