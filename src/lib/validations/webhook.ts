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
      commit_hash: z.string().optional(),
      branch: z.string().optional(),
      ci_url: z.string().url().optional(),
      pipeline_id: z.string().optional(),
      environment: z.string().optional(),
      test_run_id: z.string().uuid().optional(),
    })
    .passthrough()
    .optional(),
});

export type PlaywrightWebhookPayload = z.infer<typeof playwrightWebhookSchema>;
export type WebhookResult = z.infer<typeof webhookResultSchema>;
