import { z } from 'zod';

export const createFeedbackSchema = z.object({
  submission_type: z.enum(['bug', 'feature_request']),
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(500, 'Title must be at most 500 characters'),
  description: z.string().trim().min(10, 'Description must be at least 10 characters'),
  severity: z.enum(['critical', 'high', 'medium', 'low']).nullable().optional(),
  steps_to_reproduce: z.string().trim().optional().nullable(),
  expected_behavior: z.string().trim().optional().nullable(),
  actual_behavior: z.string().trim().optional().nullable(),
  loom_url: z.string().url('Must be a valid URL').optional().nullable().or(z.literal('')),
  submitter_name: z.string().trim().max(200).optional().nullable(),
  submitter_email: z.string().email('Must be a valid email').optional().nullable().or(z.literal('')),
  environment: z.enum(['production', 'staging', 'development']).optional().nullable(),
  project_id: z.string().uuid('Must be a valid project ID').optional().nullable(),
  _hp_field: z.string().optional().nullable(),
});

export const updateFeedbackSchema = z.object({
  status: z.enum(['new', 'under_review', 'accepted', 'rejected', 'exported']).optional(),
  internal_notes: z.string().optional().nullable(),
  project_id: z.string().uuid('Must be a valid project ID').optional().nullable(),
});

export type CreateFeedbackInput = z.infer<typeof createFeedbackSchema>;
export type UpdateFeedbackInput = z.infer<typeof updateFeedbackSchema>;
