import { z } from 'zod';
import { SIM_ENVIRONMENTS, isValidApiBase, normalizeApiBase } from '@/lib/partner-sim/environments';

const apiKey = z
  .string()
  .trim()
  .regex(/^fsrx_(test|live)_\S+$/, 'Must be a FullStackRx partner key (fsrx_test_… or fsrx_live_…)');

const webhookSecret = z
  .string()
  .trim()
  .regex(/^whsec_\S+$/, 'Must be a webhook signing secret (whsec_…)');

const apiBaseUrl = z
  .string()
  .trim()
  .refine(isValidApiBase, 'Must be the API base URL, e.g. https://api.example.com (with or without /v1)')
  .transform(normalizeApiBase);

export const createPartnerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  environment: z.enum(SIM_ENVIRONMENTS),
  api_base_url: apiBaseUrl,
  api_key: apiKey,
  webhook_secret: webhookSecret.optional().or(z.literal('').transform(() => undefined)),
  webhook_response_status: z.number().int().min(200).max(599).optional(),
});

export const updatePartnerSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  environment: z.enum(SIM_ENVIRONMENTS).optional(),
  api_base_url: apiBaseUrl.optional(),
  /** Omit to keep the stored key. */
  api_key: apiKey.optional(),
  /** Omit to keep, null to remove. */
  webhook_secret: webhookSecret.nullable().optional(),
  webhook_response_status: z.number().int().min(200).max(599).optional(),
});

export const prescriberSchema = z.object({
  npi: z.string().regex(/^\d{10}$/, 'NPI is 10 digits'),
  first_name: z.string().trim().min(1).max(100),
  last_name: z.string().trim().min(1).max(100),
  license_state: z.string().regex(/^[A-Z]{2}$/, 'Two-letter state'),
  license_number: z.string().trim().min(1).max(50),
  note: z.string().trim().max(500).optional().nullable(),
});

export const submitOrderSchema = z.object({
  /** Sent as-is, so QA can also send deliberately broken payloads. */
  request: z.record(z.string(), z.unknown()),
  /** Printable ASCII only (it goes in a header). Omit for a fresh UUID. */
  idempotency_key: z
    .string()
    .regex(/^[\x21-\x7e]{1,255}$/, 'Printable ASCII, up to 255 characters')
    .optional(),
  /** false sends no Idempotency-Key at all (expect 400 idempotency_key_required). */
  send_idempotency_key: z.boolean().optional().default(true),
  preset: z.string().max(50).optional(),
  retry_of: z.string().uuid().optional(),
});

export const cancelOrderSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export type CreatePartnerInput = z.infer<typeof createPartnerSchema>;
export type UpdatePartnerInput = z.infer<typeof updatePartnerSchema>;
export type PrescriberInput = z.infer<typeof prescriberSchema>;
export type SubmitOrderInput = z.infer<typeof submitOrderSchema>;
