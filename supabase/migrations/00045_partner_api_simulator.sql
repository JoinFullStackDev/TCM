-- Migration 00045: Partner API simulator
--
-- Lets QA drive FullStackRx's Partner Order API (/v1/*) from TCM without writing code:
-- saved partner profiles (key + webhook secret), saved prescribers, every order request
-- the simulator sent with the response it got, and every webhook FullStackRx delivered.
--
-- Secrets: api_key_encrypted and webhook_secret_encrypted hold AES-256-GCM ciphertext
-- produced by the app (src/lib/partner-sim/crypto.ts, key = PARTNER_SIM_ENCRYPTION_KEY).
-- The plaintext never reaches the browser; the UI only ever sees the *_last4 columns.
--
-- Access: RLS is enabled with NO policies on every table, so the anon and authenticated
-- roles can't read or write them through PostgREST. The route handlers check the
-- caller's TCM role (withAuth('write')) and then use the service-role client, which
-- bypasses RLS. The public webhook receiver (/api/webhooks/partner-sim/<partnerId>)
-- also writes with the service-role client.

CREATE TABLE partner_sim_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  -- Which FullStackRx environment the key belongs to. The base URL is resolved
  -- server-side from env vars (PARTNER_SIM_<ENV>_API_URL), never from the browser.
  environment text NOT NULL CHECK (environment IN ('local', 'qa', 'staging')),
  api_key_encrypted text NOT NULL,
  api_key_last4 text NOT NULL,
  api_key_mode text NOT NULL CHECK (api_key_mode IN ('test', 'live')),
  webhook_secret_encrypted text,
  webhook_secret_last4 text,
  -- What the receiver answers FullStackRx with, so QA can exercise webhook retries.
  webhook_response_status integer NOT NULL DEFAULT 200
    CHECK (webhook_response_status BETWEEN 200 AND 599),
  -- Cached GET /v1/connection and GET /v1/catalog answers for the order builder.
  connection jsonb,
  connection_checked_at timestamptz,
  catalog jsonb,
  catalog_fetched_at timestamptz,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Prescribers QA has used with a partner. Reusing one matters: a brand-new prescriber's
-- first order intentionally stops in the pharmacy's Partner Inbox for a licence review.
CREATE TABLE partner_sim_prescribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partner_sim_partners(id) ON DELETE CASCADE,
  npi text NOT NULL CHECK (npi ~ '^\d{10}$'),
  first_name text NOT NULL,
  last_name text NOT NULL,
  license_state text NOT NULL CHECK (license_state ~ '^[A-Z]{2}$'),
  license_number text NOT NULL,
  note text,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (partner_id, npi)
);

-- One row per request the simulator sent to POST /v1/orders (a retry with the same
-- Idempotency-Key is its own row, so QA can compare the replay with the original).
CREATE TABLE partner_sim_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partner_sim_partners(id) ON DELETE CASCADE,
  partner_order_id text,
  preset text,
  idempotency_key text NOT NULL,
  retry_of uuid REFERENCES partner_sim_orders(id) ON DELETE SET NULL,
  request_body jsonb NOT NULL,
  response_status integer,
  response_body jsonb,
  -- A few response headers worth showing (Idempotent-Replayed, Content-Type, Location).
  response_headers jsonb,
  duration_ms integer,
  error_message text,
  -- FullStackRx's order id (response.id) once the order was accepted for intake.
  fsrx_order_id text,
  -- Latest order status: from the create answer, then GET /v1/orders/{id} or cancel.
  status text,
  last_order jsonb,
  last_refreshed_at timestamptz,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX partner_sim_orders_partner_idx ON partner_sim_orders (partner_id, created_at DESC);
CREATE INDEX partner_sim_orders_fsrx_order_idx ON partner_sim_orders (fsrx_order_id);

-- Webhooks FullStackRx delivered to /api/webhooks/partner-sim/<partnerId>.
-- Deduped on (partner_id, event_id); a redelivery bumps delivery_count.
CREATE TABLE partner_sim_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partner_sim_partners(id) ON DELETE CASCADE,
  event_id text,
  event_type text,
  event_created_at timestamptz,
  livemode boolean,
  fsrx_order_id text,
  partner_order_id text,
  item_id text,
  signature_valid boolean NOT NULL DEFAULT false,
  -- Why the signature didn't verify: missing_header, malformed, stale, mismatch, no_secret.
  signature_error text,
  headers jsonb,
  body jsonb,
  raw_body text,
  delivery_count integer NOT NULL DEFAULT 1,
  received_at timestamptz NOT NULL DEFAULT now(),
  last_received_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX partner_sim_webhook_events_dedupe_idx
  ON partner_sim_webhook_events (partner_id, event_id)
  WHERE event_id IS NOT NULL;
CREATE INDEX partner_sim_webhook_events_order_idx
  ON partner_sim_webhook_events (partner_id, fsrx_order_id, event_created_at);

ALTER TABLE partner_sim_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_sim_prescribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_sim_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_sim_webhook_events ENABLE ROW LEVEL SECURITY;
