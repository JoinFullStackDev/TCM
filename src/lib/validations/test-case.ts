import { z } from 'zod';

const automationStatusEnum = z.enum(['not_automated', 'scripted', 'in_cicd', 'out_of_sync']);
const testCaseTypeEnum = z.enum(['functional', 'performance']);
const platformEnum = z.enum(['desktop', 'tablet', 'mobile']);
const priorityEnum = z.enum(['low', 'medium', 'high', 'critical']);
const categoryEnum = z.enum(['smoke', 'regression', 'integration', 'e2e', 'unit', 'acceptance', 'exploratory', 'performance', 'security', 'usability']);

export const createTestCaseSchema = z.object({
  suite_id: z.string().uuid(),
  title: z.string().trim().min(1, 'Title is required').max(500),
  description: z.string().trim().max(5000).nullable().optional(),
  precondition: z.string().trim().max(5000).nullable().optional(),
  type: testCaseTypeEnum.optional().default('functional'),
  automation_status: automationStatusEnum.optional().default('not_automated'),
  automation_file_path: z.string().trim().max(500).nullable().optional(),
  platform_tags: z.array(platformEnum).optional().default([]),
  priority: priorityEnum.nullable().optional(),
  tags: z.array(z.string().trim().max(50)).optional().default([]),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
  category: categoryEnum.nullable().optional(),
});

export const updateTestCaseSchema = z.object({
  title: z.string().trim().min(1).max(500).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  precondition: z.string().trim().max(5000).nullable().optional(),
  type: testCaseTypeEnum.optional(),
  automation_status: automationStatusEnum.optional(),
  automation_file_path: z.string().trim().max(500).nullable().optional(),
  platform_tags: z.array(platformEnum).optional(),
  priority: priorityEnum.nullable().optional(),
  tags: z.array(z.string().trim().max(50)).optional(),
  position: z.number().int().min(0).optional(),
  suite_id: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  category: categoryEnum.nullable().optional(),
});

export const bulkUpdateSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, 'Select at least one test case'),
  updates: z.object({
    automation_status: automationStatusEnum.optional(),
    platform_tags: z.array(platformEnum).optional(),
    priority: priorityEnum.nullable().optional(),
    type: testCaseTypeEnum.optional(),
    category: categoryEnum.nullable().optional(),
  }),
});

export const reorderTestCasesSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().uuid(),
      position: z.number().int().min(0),
    }),
  ).min(1),
});

export type CreateTestCaseInput = z.infer<typeof createTestCaseSchema>;
export type UpdateTestCaseInput = z.infer<typeof updateTestCaseSchema>;
export type BulkUpdateInput = z.infer<typeof bulkUpdateSchema>;
export type ReorderTestCasesInput = z.infer<typeof reorderTestCasesSchema>;
