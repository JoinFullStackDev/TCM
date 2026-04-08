import { z } from 'zod';

const executionStatusEnum = z.enum(['not_run', 'pass', 'fail', 'blocked', 'skip']);
const platformEnum = z.enum(['desktop', 'tablet', 'mobile']);

export const upsertResultSchema = z.object({
  test_case_id: z.string().uuid(),
  test_step_id: z.string().uuid(),
  platform: platformEnum,
  browser: z.string().trim().max(100).optional().default('default'),
  status: executionStatusEnum,
  comment: z.string().trim().max(2000).nullable().optional(),
});

export const upsertResultsSchema = z.object({
  results: z.array(upsertResultSchema).min(1),
});

export const createAnnotationSchema = z.object({
  execution_result_id: z.string().uuid(),
  comment: z.string().trim().max(5000).nullable().optional(),
});

export type UpsertResultInput = z.infer<typeof upsertResultSchema>;
export type UpsertResultsInput = z.infer<typeof upsertResultsSchema>;
export type CreateAnnotationInput = z.infer<typeof createAnnotationSchema>;
