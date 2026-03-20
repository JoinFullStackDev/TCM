import { z } from 'zod';

const webhookResultSchema = z.object({
  test_case_id: z.string().min(1),
  status: z.enum(['pass', 'fail', 'skip', 'blocked', 'not_run']),
  duration_ms: z.number().optional(),
  steps: z
    .array(
      z.object({
        step_number: z.number(),
        status: z.enum(['pass', 'fail', 'skip', 'blocked', 'not_run']),
        error_message: z.string().optional(),
      }),
    )
    .optional(),
});

export const playwrightWebhookSchema = z.object({
  project_id: z.string().uuid('project_id must be a valid UUID'),
  event_type: z.enum(['test_run_completed']).default('test_run_completed'),
  run_name: z.string().max(200).optional(),
  results: z.array(webhookResultSchema).min(1, 'At least one result is required'),
  metadata: z
    .object({
      commit_hash: z.string().nullish(),
      branch: z.string().nullish(),
      ci_url: z.string().url().nullish(),
      pipeline_id: z.string().nullish(),
      environment: z.string().nullish(),
      test_run_id: z.string().uuid().nullish(),
    })
    .passthrough()
    .optional(),
});

export type PlaywrightWebhookPayload = z.infer<typeof playwrightWebhookSchema>;
export type WebhookResult = z.infer<typeof webhookResultSchema>;
