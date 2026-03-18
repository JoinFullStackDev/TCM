import { z } from 'zod';

const noteVisibilityEnum = z.enum(['private', 'team']);

const meetingUrlSchema = z
  .union([z.string().trim().url().max(2000), z.literal('')])
  .nullable()
  .optional()
  .transform((val) => (val === '' ? null : val));

export const createNoteSchema = z.object({
  title: z.string().trim().max(500).nullable().optional(),
  content: z.string().max(100000).optional().default(''),
  content_plain: z.string().max(100000).nullable().optional(),
  visibility: noteVisibilityEnum.optional().default('private'),
  meeting_url: meetingUrlSchema,
  is_pinned: z.boolean().optional().default(false),
});

export const updateNoteSchema = z.object({
  title: z.string().trim().max(500).nullable().optional(),
  content: z.string().max(100000).optional(),
  content_plain: z.string().max(100000).nullable().optional(),
  summary: z.string().max(10000).nullable().optional(),
  visibility: noteVisibilityEnum.optional(),
  meeting_url: meetingUrlSchema,
  is_pinned: z.boolean().optional(),
});

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
