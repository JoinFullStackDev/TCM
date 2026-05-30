'use client';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import AgentKanbanCard from './AgentKanbanCard';
import type { AgentRun } from '@/types/agent-run';

interface Props {
  label: string;
  runs: AgentRun[];
  childMap: Map<string, AgentRun[]>;
  onAction?: () => void;
}

export default function AgentKanbanColumn({ label, runs, childMap, onAction }: Props) {
  // Sort newest first (by createdAt descending)
  const sorted = [...runs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const count = runs.length;

  return (
    <Paper
      variant="outlined"
      sx={{
        minWidth: 280,
        maxWidth: 320,
        flex: '0 0 300px',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: 'calc(100vh - 220px)',
        borderRadius: 2,
        bgcolor: 'background.default',
      }}
    >
      {/* Column header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 1.5,
          py: 1,
          borderBottom: '1px solid',
          borderColor: 'divider',
          flexShrink: 0,
        }}
      >
        <Typography variant="subtitle2" fontWeight={700} sx={{ textTransform: 'capitalize' }}>
          {label}
        </Typography>
        <Chip
          label={count}
          size="small"
          sx={{
            fontWeight: 700,
            fontSize: '0.72rem',
            height: 20,
            bgcolor: count > 0 ? 'primary.main' : 'action.disabledBackground',
            color: count > 0 ? 'primary.contrastText' : 'text.disabled',
          }}
        />
      </Box>

      {/* Scrollable card list */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          px: 1,
          py: 1,
          '&::-webkit-scrollbar': { width: 4 },
          '&::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 2 },
        }}
      >
        {sorted.length === 0 ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              py: 4,
              opacity: 0.3,
            }}
          >
            <SmartToyOutlinedIcon sx={{ fontSize: 32, mb: 1 }} />
            <Typography variant="caption" color="text.disabled">
              No runs
            </Typography>
          </Box>
        ) : (
          sorted.map((run) => {
            const runChildren = childMap.get(run.id) ?? [];
            return (
              <AgentKanbanCard
                key={run.id}
                run={run}
                children={runChildren}
                onAction={onAction}
              />
            );
          })
        )}
      </Box>
    </Paper>
  );
}
