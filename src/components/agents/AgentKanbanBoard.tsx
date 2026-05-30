'use client';

import Box from '@mui/material/Box';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ToggleButton from '@mui/material/ToggleButton';
import Typography from '@mui/material/Typography';
import TableRowsIcon from '@mui/icons-material/TableRows';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import AgentKanbanColumn from './AgentKanbanColumn';
import type { AgentRun, AgentRunStatus, AgentName } from '@/types/agent-run';

export type BoardGrouping = 'status' | 'agent';

const STATUS_COLUMNS: AgentRunStatus[] = [
  'spawned',
  'running',
  'waiting',
  'done',
  'failed',
  'timed_out',
  'killed',
];

const STATUS_LABELS: Record<AgentRunStatus, string> = {
  spawned: 'Spawned',
  running: 'Running',
  waiting: 'Waiting',
  done: 'Done',
  failed: 'Failed',
  timed_out: 'Timed Out',
  killed: 'Killed',
};

const AGENT_COLUMNS: AgentName[] = ['riff', 'arc', 'axel', 'torque', 'clutch'];

const AGENT_LABELS: Record<AgentName, string> = {
  riff: 'Riff',
  arc: 'ARC',
  axel: 'Axel',
  torque: 'Torque',
  clutch: 'Clutch',
};

interface Props {
  runs: AgentRun[];
  childMap: Map<string, AgentRun[]>;
  grouping: BoardGrouping;
  onGroupingChange: (next: BoardGrouping) => void;
  onAction?: () => void;
}

export default function AgentKanbanBoard({
  runs,
  childMap,
  grouping,
  onGroupingChange,
  onAction,
}: Props) {
  // Only use top-level runs for column grouping; children render inside their parent card
  const topLevel = runs.filter((r) => !r.parentRunId);

  function handleGroupingChange(_: React.MouseEvent<HTMLElement>, value: BoardGrouping | null) {
    if (value) onGroupingChange(value);
  }

  const columns =
    grouping === 'status'
      ? STATUS_COLUMNS.map((status) => ({
          key: status,
          label: STATUS_LABELS[status],
          runs: topLevel.filter((r) => r.status === status),
        }))
      : AGENT_COLUMNS.map((agent) => ({
          key: agent,
          label: AGENT_LABELS[agent],
          runs: topLevel.filter((r) => r.agent === agent),
        }));

  return (
    <Box>
      {/* Board grouping toggle */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
          Group by
        </Typography>
        <ToggleButtonGroup
          value={grouping}
          exclusive
          onChange={handleGroupingChange}
          size="small"
          aria-label="board grouping"
        >
          <ToggleButton value="status" aria-label="group by status">
            <TableRowsIcon sx={{ fontSize: 16, mr: 0.5 }} />
            <Typography variant="caption" sx={{ fontWeight: 600, textTransform: 'none' }}>
              Status
            </Typography>
          </ToggleButton>
          <ToggleButton value="agent" aria-label="group by agent">
            <PersonOutlineIcon sx={{ fontSize: 16, mr: 0.5 }} />
            <Typography variant="caption" sx={{ fontWeight: 600, textTransform: 'none' }}>
              Agent
            </Typography>
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Board columns */}
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          overflowX: 'auto',
          pb: 2,
          alignItems: 'flex-start',
          '&::-webkit-scrollbar': { height: 6 },
          '&::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 3 },
        }}
      >
        {columns.map((col) => (
          <AgentKanbanColumn
            key={col.key}
            label={col.label}
            runs={col.runs}
            childMap={childMap}
            onAction={onAction}
          />
        ))}
      </Box>
    </Box>
  );
}
