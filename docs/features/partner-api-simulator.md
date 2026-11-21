# Partner API Simulator

**Where:** sidebar → Testing → **Partner API Sim** (`/partner-sim`). QA Engineer role and above.

Lets QA act as a telehealth partner against FullStackRx's Partner Order API (`/v1/*`) without writing code:
save test partners with their keys, sync a connection's catalog, generate valid (or deliberately broken)
orders with one click, send them, track their status, and watch the signed webhooks FullStackRx sends back.

## How requests reach FullStackRx

QA's FullStackRx sits behind an internal load balancer that only admits the VPN, so TCM's server (Vercel)
can't reach it. Each partner therefore has a **call mode**:

| Call mode | Who calls FullStackRx | Use for | Needs |
|---|---|---|---|
| **My browser** (default for QA) | the tester's browser; TCM only records the answer | QA (VPN) | VPN on, and FullStackRx's CORS allowing TCM's origin on `/v1` |
| **TCM's server** (default for staging) | TCM's route handlers | staging (public) | the environment reachable from the internet |

Until FullStackRx allows TCM's origin in CORS, browser mode fails with a message naming the VPN and CORS;
the browser console shows which. Webhooks always go FullStackRx → TCM's public receiver, so they work in
both modes.

## How QA uses it

1. **In FullStackRx** (pharmacy admin on a *test* pharmacy): Settings → Partner connections → open or
   create the connection → **Keys** → issue a key. On QA/staging use a `fsrx_live_` key on a test pharmacy;
   `fsrx_test_` keys run every check and send webhooks but cancel themselves and create nothing.
2. **In TCM:** Partner API Sim → **New partner**. One partner per connection you test; make as many as you
   like. Enter a name, the environment, the **API base URL**, the key and (optionally) the `whsec_…` secret.
   Keys are encrypted at rest and can be shown or copied again from the partner's *Connection & catalog* tab.
3. Click **Sync connection & catalog** (`GET /v1/connection` and `/v1/catalog`). This caches the allowed
   states, SKUs, prices and shipping methods for the order builder.
4. **Webhooks:** on *Connection & catalog*, copy the *Webhook receiver* URL into the connection's
   **Webhooks** tab in FullStackRx, and paste the signing secret it shows into the partner (**Edit**).
5. **Order builder:** pick a preset and press **Randomize**; every field stays editable (or use **Raw
   JSON**). Press **Send order**.

   | Preset | Expect |
   |---|---|
   | Happy path | 201, then `order.accepted` (reuses the latest saved prescriber) |
   | New prescriber (goes to inbox) | 201, then `order.needs_attention` (licence review in the Partner Inbox) |
   | Bad NPI | 422 `invalid_npi` |
   | Disallowed state | 422 `state_not_allowed` |
   | Unknown SKU | 422 `unknown_sku` |
   | Duplicate partnerOrderId | 409 `duplicate_order` |
   | Not prepaid | 422 `payment_required` |
   | Missing attestation | 422 `attestation_required` |

   *Idempotency:* each send uses a new `Idempotency-Key`. **Retry with same key** resends the identical body
   with the same key (expect the same order back); "Use this key" with a changed body should give 409
   `idempotency_key_reused`; "Send none" should give 400 `idempotency_key_required`.
6. **Orders tab:** every request with its response. Open one to **Refresh** (`GET /v1/orders/{id}`),
   **Cancel** (`POST /v1/orders/{id}/cancel`), retry it, and see its webhook timeline (deduped on event id,
   ordered by the event's `createdAt`).
7. **Prescribers tab:** a brand-new prescriber's first order waits in the pharmacy's Partner Inbox. Approve it
   there; every prescriber on an accepted order is saved automatically, and Happy path reuses the latest.
8. **Swap keys:** after a partner's key has sent 10 orders, the partner page reminds you to swap it: issue a
   new key on the connection's Keys tab, revoke the old one, and paste the new one via **Swap key**. (One
   order with the old key afterwards should get 401 `key_revoked`.)

To watch FullStackRx retry a failed webhook delivery, Edit the partner and set *Webhook receiver answers
with* to a 4xx/5xx.

## Configuration

Nothing is required beyond TCM's existing Supabase env vars, plus migrations `00045` and `00046`. Optional:

| Var | Purpose |
|---|---|
| `PARTNER_SIM_ENCRYPTION_KEY` | 64 hex chars. Otherwise derived from `SUPABASE_SERVICE_ROLE_KEY`. Changing either makes stored keys unreadable (re-enter them). |
| `PARTNER_SIM_QA_API_URL`, `PARTNER_SIM_STAGING_API_URL` | Pre-fill a new partner's API base URL. |
| `PARTNER_SIM_QA_UI_URL`, `PARTNER_SIM_STAGING_UI_URL` | Link the environment's `/partner-api-docs`. |
| `PARTNER_SIM_WEBHOOK_BASE_URL` | Origin shown in the webhook URL, if not the one TCM is browsed on. |

## Design notes

- Tables: `partner_sim_partners`, `partner_sim_prescribers`, `partner_sim_orders`, `partner_sim_webhook_events`
  (migrations `00045`, `00046`). RLS is on with no policies; route handlers check the TCM role with
  `withAuth('write')` and use the service-role client.
- One transport (`src/lib/partner-sim/transport.ts`) makes every call, from the server or the browser; the
  recorded request always has the key redacted. In browser mode the UI fetches the key from
  `/api/partner-sim/partners/<id>/credentials` (QA/staging test keys only).
- The webhook receiver is `POST /api/webhooks/partner-sim/<partnerId>` (public, like the other
  `/api/webhooks/*` routes). It verifies `t=<unix>,v1=<hex HMAC-SHA256 of "<t>.<raw body>">` keyed with the
  whole `whsec_…` secret, refuses a `t` more than 300 s away, stores every delivery (valid or not) and answers
  with the partner's configured status.
- `npm test` covers NPI check digits, the order randomizer, the transport, signature verification, the
  webhook timeline and encryption.
