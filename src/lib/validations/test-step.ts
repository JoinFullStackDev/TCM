import { z } from 'zod';

const categoryEnum = z.enum(['smoke', 'regression', 'integration', 'e2e', 'unit', 'acceptance', 'exploratory', 'performance', 'security', 'usability']);

export const stepSchema = z.object({
  step_number: z.number().int().min(1),
  description: z.string().trim().min(1, 'Step description is required').max(5000),
  test_data: z.string().trim().max(5000).nullable().optional(),
  expected_result: z.string().trim().max(5000).nullable().optional(),
  is_automation_only: z.boolean().optional().default(false),
  category: categoryEnum.nullable().optional(),
});

export const replaceStepsSchema = z.object({
  steps: z.array(stepSchema).min(0),
});

export type StepInput = z.infer<typeof stepSchema>;
export type ReplaceStepsInput = z.infer<typeof replaceStepsSchema>;
