import { z } from 'zod';

const systemFieldEnum = z.enum([
  'display_id',
  'description',
  'precondition',
  'step_number',
  'step_description',
  'test_data',
  'expected_result',
  'platform_results',
  'automation_status_cell',
  'comments',
  'bug_link',
  'overall_status',
  'execution_date',
  'unmapped',
]);

export const columnMappingSchema = z.record(z.string(), systemFieldEnum);

const parsedStepSchema = z.object({
  step_number: z.number(),
  description: z.string(),
  test_data: z.string().nullable().optional(),
  expected_result: z.string().nullable().optional(),
  is_automation_only: z.boolean().default(false),
  platform_results: z
    .array(
      z.object({
        platform: z.enum(['desktop', 'tablet', 'mobile']),
        status: z.enum(['not_run', 'pass', 'fail', 'blocked', 'skip']),
      }),
    )
    .optional(),
  comments: z.string().nullable().optional(),
  bug_links: z.array(z.string().url()).optional(),
});

const parsedTestCaseSchema = z.object({
  display_id: z.string(),
  suite_name: z.string(),
  prefix: z.string(),
  sequence_number: z.number(),
  title: z.string(),
  description: z.string().nullable().optional(),
  precondition: z.string().nullable().optional(),
  automation_status: z.enum([
    'not_automated',
    'scripted',
    'in_cicd',
    'out_of_sync',
  ]),
  platform_tags: z.array(z.enum(['desktop', 'tablet', 'mobile'])),
  overall_status_text: z.string().nullable().optional(),
  execution_dates: z
    .object({
      startDate: z.string().nullable(),
      completionDate: z.string().nullable(),
    })
    .optional(),
  steps: z.array(parsedStepSchema),
  bug_links: z.array(z.string()).optional(),
});

export const importPayloadSchema = z.object({
  project_id: z.string().uuid(),
  column_mappings: columnMappingSchema,
  parsed_data: z.array(parsedTestCaseSchema),
  duplicate_strategy: z.enum(['skip', 'update']).default('skip'),
  file_name: z.string(),
  file_size: z.number().optional(),
});

export const parseRequestSchema = z.object({
  import_id: z.string().uuid(),
  confirmed_mappings: z.array(z.object({
    csvIndex: z.number(),
    csvHeader: z.string(),
    systemField: systemFieldEnum,
    confidence: z.enum(['high', 'medium', 'low']),
  })),
});

export const executeRequestSchema = z.object({
  import_id: z.string().uuid(),
  duplicate_strategy: z.enum(['skip', 'update']).default('skip'),
});

export type ColumnMapping = z.infer<typeof columnMappingSchema>;
export type ParsedStep = z.infer<typeof parsedStepSchema>;
export type ParsedTestCase = z.infer<typeof parsedTestCaseSchema>;
export type ImportPayload = z.infer<typeof importPayloadSchema>;
export type ParseRequest = z.infer<typeof parseRequestSchema>;
export type ExecuteRequest = z.infer<typeof executeRequestSchema>;
