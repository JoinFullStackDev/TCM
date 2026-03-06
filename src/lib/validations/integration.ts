import { z } from 'zod';

const slackConfigSchema = z.object({
  webhook_url: z
    .string()
    .url('Must be a valid URL')
    .startsWith('https://hooks.slack.com/', 'Must be a Slack webhook URL'),
  channel: z.string().trim().max(100).optional().default(''),
  failure_threshold: z.number().int().min(0).optional().default(5),
  mention_usergroups: z.array(z.string().trim()).optional().default([]),
  notify_on: z.enum(['all', 'failures_only']).optional().default('all'),
});

export const createIntegrationSchema = z.object({
  project_id: z.string().uuid(),
  suite_id: z.string().uuid().nullable().optional(),
  type: z.enum(['slack', 'gitlab']),
  config: slackConfigSchema,
  is_active: z.boolean().optional().default(true),
});

export const updateIntegrationSchema = z.object({
  config: slackConfigSchema.partial().optional(),
  is_active: z.boolean().optional(),
  suite_id: z.string().uuid().nullable().optional(),
});

export const testSlackSchema = z.object({
  webhook_url: z
    .string()
    .url('Must be a valid URL')
    .startsWith('https://hooks.slack.com/', 'Must be a Slack webhook URL'),
});

export type CreateIntegrationInput = z.infer<typeof createIntegrationSchema>;
export type UpdateIntegrationInput = z.infer<typeof updateIntegrationSchema>;
export type SlackConfigInput = z.infer<typeof slackConfigSchema>;
