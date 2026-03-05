import { z } from 'zod';

const testRunStatusEnum = z.enum(['planned', 'in_progress', 'completed', 'aborted']);

export const createTestRunSchema = z.object({
  project_id: z.string().uuid(),
  suite_id: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1, 'Name is required').max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  target_version: z.string().trim().max(100).nullable().optional(),
  environment: z.string().trim().max(100).nullable().optional(),
  start_date: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
  assignee_id: z.string().uuid().nullable().optional(),
});

export const updateTestRunSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  target_version: z.string().trim().max(100).nullable().optional(),
  environment: z.string().trim().max(100).nullable().optional(),
  status: testRunStatusEnum.optional(),
  start_date: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
  assignee_id: z.string().uuid().nullable().optional(),
});

export const addCasesSchema = z.object({
  test_case_ids: z.array(z.string().uuid()).min(1, 'Select at least one test case'),
});

export const removeCasesSchema = z.object({
  test_case_ids: z.array(z.string().uuid()).min(1),
});

export type CreateTestRunInput = z.infer<typeof createTestRunSchema>;
export type UpdateTestRunInput = z.infer<typeof updateTestRunSchema>;
export type AddCasesInput = z.infer<typeof addCasesSchema>;
export type RemoveCasesInput = z.infer<typeof removeCasesSchema>;
