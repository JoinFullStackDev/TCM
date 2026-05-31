import { z } from 'zod';

export const TERMINAL_STATUSES = ['done', 'failed', 'timed_out', 'killed'] as const;
export const VALID_AGENTS = ['axel', 'riff', 'arc', 'torque', 'clutch'] as const;
export const VALID_STATUSES = ['spawned', 'running', 'waiting', 'done', 'failed', 'timed_out', 'killed'] as const;

export const OUTPUT_TAIL_MAX_BYTES = 65_536;

export const CreateRunSchema = z.object({
  agent: z.enum(VALID_AGENTS),
  brief: z.string().min(1).max(512),
  sessionKey: z.string().min(1).max(128),
  spawnedBy: z.string().min(1).max(256),
  slackChannel: z.string().max(64).optional(),
  slackThreadTs: z.string().max(64).optional(),
  projectTag: z.string().max(64).optional(),
  startedAt: z.string().datetime(),
  parentRunId: z.string().uuid().optional().nullable(),
  // Task detail fields (replaces FullThrottle task tracking)
  taskTitle: z.string().max(256).optional().nullable(),
  taskDescription: z.string().optional().nullable(),
  expectedOutcome: z.string().optional().nullable(),
});

export const PatchRunSchema = z
  .object({
    status: z.enum(VALID_STATUSES).optional(),
    lastHeartbeat: z.string().datetime().optional(),
    outputTail: z.string().optional(),
    endedAt: z.string().datetime().optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Patch body must not be empty',
  });

export type CreateRunInput = z.infer<typeof CreateRunSchema>;
export type PatchRunInput = z.infer<typeof PatchRunSchema>;
