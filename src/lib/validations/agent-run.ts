import { z } from 'zod';

export const agentRunStatusEnum = z.enum([
  'spawned',
  'running',
  'waiting',
  'done',
  'failed',
  'timed_out',
  'killed',
]);

export const agentNameEnum = z.enum(['axel', 'riff', 'arc', 'torque', 'clutch']);

export const createAgentRunSchema = z.object({
  agent: agentNameEnum,
  brief: z.string().trim().min(1, 'Brief is required').max(512),
  session_key: z.string().trim().min(1).max(128),
  spawned_by: z.string().trim().min(1).max(256),
  slack_channel: z.string().trim().max(64).nullable().optional(),
  slack_thread_ts: z.string().trim().max(64).nullable().optional(),
  project_tag: z.string().trim().max(64).nullable().optional(),
  started_at: z.string().datetime(),
  parent_run_id: z.string().uuid().nullable().optional(),
});

export const updateAgentRunSchema = z.object({
  status: agentRunStatusEnum.optional(),
  output_tail: z.string().nullable().optional(),
  last_heartbeat: z.string().datetime().optional(),
  ended_at: z.string().datetime().nullable().optional(),
});

export const listAgentRunsQuerySchema = z.object({
  agent: agentNameEnum.optional(),
  status: agentRunStatusEnum.optional(),
  project_tag: z.string().max(64).optional(),
  include_archived: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(100),
});

export type CreateAgentRunInput = z.infer<typeof createAgentRunSchema>;
export type UpdateAgentRunInput = z.infer<typeof updateAgentRunSchema>;
export type ListAgentRunsQuery = z.infer<typeof listAgentRunsQuerySchema>;
export type AgentRunStatus = z.infer<typeof agentRunStatusEnum>;
export type AgentName = z.infer<typeof agentNameEnum>;
