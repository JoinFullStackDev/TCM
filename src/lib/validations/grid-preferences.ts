import { z } from 'zod';

export const upsertGridPreferencesSchema = z.object({
  project_id: z.string().uuid(),
  suite_id: z.string().uuid().nullable().optional(),
  column_config: z.object({
    columnOrder: z.array(z.string()).optional(),
    columnWidths: z.record(z.string(), z.number()).optional(),
    columnVisibility: z.record(z.string(), z.boolean()).optional(),
  }),
});

export type UpsertGridPreferencesInput = z.infer<typeof upsertGridPreferencesSchema>;
