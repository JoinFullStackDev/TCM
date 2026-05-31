export type AgentRunStatus =
  | 'spawned'
  | 'running'
  | 'waiting'
  | 'done'
  | 'failed'
  | 'timed_out'
  | 'killed';

export type AgentName = 'axel' | 'riff' | 'arc' | 'torque' | 'clutch';

export interface AgentRun {
  id: string;
  agent: AgentName;
  brief: string;
  taskTitle: string | null;
  taskDescription: string | null;
  expectedOutcome: string | null;
  status: AgentRunStatus;
  sessionKey: string;
  spawnedBy: string;
  slackChannel: string | null;
  slackThreadTs: string | null;
  projectTag: string | null;
  startedAt: string;
  lastHeartbeat: string | null;
  endedAt: string | null;
  outputTail: string | null;
  outputTruncated: boolean;
  parentRunId: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgentRunsResponse {
  runs: AgentRun[];
  total: number;
  limit: number;
  offset: number;
}

export interface AgentRunFilters {
  status?: string;
  agent?: string;
  projectTag?: string;
  search?: string;
  includeArchived?: boolean;
}
