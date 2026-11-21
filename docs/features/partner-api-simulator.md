# Partner API Simulator

**Where:** sidebar → Testing → **Partner API Sim** (`/partner-sim`). QA Engineer role and above.

Lets QA act as a telehealth partner against FullStackRx's Partner Order API (`/v1/*`) without writing code:
save a partner's API key, sync its catalog, generate valid (or deliberately broken) orders with one click,
send them, track their status, and watch the signed webhooks FullStackRx sends back.

## How QA uses it

1. **In FullStackRx** (as a pharmacy admin on a *test* pharmacy): Settings → Partner connections → open or
   create the connection → **Keys** → issue a key. On QA/staging use a `fsrx_live_` key on a test pharmacy;
   `fsrx_test_` keys run every check and send webhooks but cancel themselves and create nothing.
2. **In TCM:** Partner API Sim → **New partner**. Name it, pick the environment (QA / Staging / Local), paste
   the key. Keys are encrypted at rest and only the last 4 characters are ever shown again.
3. Click **Sync connection & catalog**. This calls `GET /v1/connection` and `GET /v1/catalog` and caches the
   allowed states, SKUs, prices and shipping methods for the order builder.
4. **Webhooks:** open the **Connection & catalog** tab, copy the *Webhook receiver* URL, paste it into the
   connection's **Webhooks** tab in FullStackRx, and copy the `whsec_…` signing secret FullStackRx shows back
   into the partner (**Edit**). Every delivery is stored and its `FullStackRx-Signature` verified.
5. **Order builder:** pick a preset and press **Randomize**; every field stays editable (or switch to
   **Raw JSON**). Press **Send order**.

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

   *Idempotency:* each send uses a new `Idempotency-Key` by default. **Retry with same key** resends the
   identical body with the same key (expect `Idempotent-Replayed: true`); "Use this key" with a changed body
   should give 409 `idempotency_key_reused`; "Send none" should give 400 `idempotency_key_required`.
6. **Orders tab:** every request with its response. Open one to **Refresh** (`GET /v1/orders/{id}`: per-item
   status and tracking), **Cancel** (`POST /v1/orders/{id}/cancel`), retry it, and see its webhook timeline
   (deduped on event id, ordered by the event's `createdAt`, since delivery order isn't guaranteed).
7. **Prescribers tab:** the first order from a brand-new prescriber waits in the pharmacy's Partner Inbox.
   Approve it there; the prescriber is saved here automatically (every 201 saves its prescriber), and the
   Happy path preset reuses the most recent one so later orders go straight through.

To watch FullStackRx retry a failed delivery, Edit the partner and set *Webhook receiver answers with* to a
4xx/5xx.

## Configuration (server env vars)

| Var | Purpose |
|---|---|
| `PARTNER_SIM_ENCRYPTION_KEY` | **Required.** 64 hex chars (`openssl rand -hex 32`). Encrypts keys and secrets. Changing it makes stored keys unreadable (re-enter them). |
| `PARTNER_SIM_QA_API_URL`, `PARTNER_SIM_STAGING_API_URL` | FullStackRx API base URL per environment (`/v1` optional). Unset = that environment shows as not configured. |
| `PARTNER_SIM_LOCAL_API_URL` | Defaults to `http://localhost:8090` outside production. |
| `PARTNER_SIM_<ENV>_UI_URL` | Optional; links the environment's `/partner-api-docs`. |
| `PARTNER_SIM_WEBHOOK_BASE_URL` | Optional; overrides the origin used in the webhook URL (e.g. `http://host.docker.internal:3000` for a local API running in Docker). |

## Design notes

- Tables: `partner_sim_partners`, `partner_sim_prescribers`, `partner_sim_orders`, `partner_sim_webhook_events`
  (migration `00045_partner_api_simulator.sql`). RLS is on with no policies; route handlers check the TCM role
  with `withAuth('write')` and use the service-role client.
- All Partner API calls are server-side (`src/lib/partner-sim/client.ts`); the browser only ever sees a
  redacted `Authorization` header. Base URLs come from env vars, never from the browser.
- The webhook receiver is `POST /api/webhooks/partner-sim/<partnerId>` (public, like the other
  `/api/webhooks/*` routes). It verifies `t=<unix>,v1=<hex HMAC-SHA256 of "<t>.<raw body>">` keyed with the
  whole `whsec_…` secret, refuses a `t` more than 300 s away, stores every delivery (valid or not) and answers
  with the partner's configured status.
- Pure logic with tests (`npm test`): NPI check digits (`npi.ts`), the order randomizer (`randomizer.ts`),
  signature verification (`signature.ts`), the webhook timeline (`webhook-events.ts`) and encryption
  (`crypto.ts`).
