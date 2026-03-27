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
  display_id: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  precondition: z.string().trim().max(5000).nullable().optional(),
  type: testCaseTypeEnum.optional(),
  automation_status: automationStatusEnum.optional(),
  automation_file_path: z.string().trim().max(500).nullable().optional(),
  platform_tags: z.array(platformEnum).optional(),
  priority: priorityEnum.nullable().optional(),
  tags: z.array(z.string().trim().max(50)).optional(),
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

/** Schema for bulk soft-delete and bulk restore operations. Max 100 IDs. */
export const bulkIdsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, 'Select at least one test case').max(100, 'Maximum 100 test cases per bulk operation'),
});

export const reorderTestCasesSchema = z.object({
  /** Ordered array of test case UUIDs; position = index + 1 is derived server-side. */
  ids: z.array(z.string().uuid()).min(1),
  /** Optional reorder_version from the suite for optimistic concurrency. */
  version: z.number().int().min(0).optional(),
});

export type CreateTestCaseInput = z.infer<typeof createTestCaseSchema>;
export type UpdateTestCaseInput = z.infer<typeof updateTestCaseSchema>;
export type BulkUpdateInput = z.infer<typeof bulkUpdateSchema>;
export type BulkIdsInput = z.infer<typeof bulkIdsSchema>;
export type ReorderTestCasesInput = z.infer<typeof reorderTestCasesSchema>;
