import { z } from 'zod';

export const createSuiteSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
  prefix: z
    .string()
    .trim()
    .min(1, 'Prefix is required')
    .max(10, 'Prefix must be 10 characters or less')
    .transform((v) => v.toUpperCase())
    .refine((v) => /^[A-Z0-9]+$/.test(v), 'Prefix must be alphanumeric'),
  description: z.string().trim().max(1000).nullable().optional(),
  tags: z.array(z.string().trim().max(50)).optional().default([]),
  group: z.string().trim().max(50).nullable().optional(),
});

export const updateSuiteSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  prefix: z
    .string()
    .trim()
    .min(1)
    .max(10)
    .transform((v) => v.toUpperCase())
    .refine((v) => /^[A-Z0-9]+$/.test(v), 'Prefix must be alphanumeric')
    .optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  tags: z.array(z.string().trim().max(50)).optional(),
  group: z.string().trim().max(50).nullable().optional(),
});

export const reorderSuitesSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().uuid(),
      position: z.number().int().min(0),
    }),
  ).min(1),
});

export type CreateSuiteInput = z.infer<typeof createSuiteSchema>;
export type UpdateSuiteInput = z.infer<typeof updateSuiteSchema>;
export type ReorderSuitesInput = z.infer<typeof reorderSuitesSchema>;
