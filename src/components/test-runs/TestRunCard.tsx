'use client';

import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Avatar from '@mui/material/Avatar';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import { alpha } from '@mui/material/styles';
import { palette, semanticColors } from '@/theme/palette';
import TestRunStatusBadge from './TestRunStatusBadge';
import type { TestRunStatus } from '@/types/database';

interface RunCounts {
  total: number;
  pass: number;
  fail: number;
  blocked: number;
  skip: number;
  not_run: number;
}

interface TestRunCardProps {
  id: string;
  name: string;
  status: TestRunStatus;
  projectName: string;
  suiteName: string | null;
  assigneeName: string | null;
  assigneeAvatar: string | null;
  startDate: string | null;
  dueDate: string | null;
  counts: RunCounts;
  isAutomated?: boolean;
}

export default function TestRunCard({
  id, name, status, projectName, suiteName,
  assigneeName, assigneeAvatar, startDate, dueDate, counts,
  isAutomated = false,
}: TestRunCardProps) {
  const router = useRouter();
  const total = counts.total || 1;

  return (
    <Box
      onClick={() => router.push(`/runs/${id}`)}
      sx={{
        p: 2.5,
        border: `1px solid ${palette.divider}`,
        borderLeft: isAutomated
          ? `3px solid ${palette.info.main}`
          : `1px solid ${palette.divider}`,
        borderRadius: '8px',
        bgcolor: 'background.paper',
        cursor: 'pointer',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        '&:hover': {
          borderColor: alpha(palette.primary.main, 0.5),
          boxShadow: `0 0 0 1px ${alpha(palette.primary.main, 0.2)}`,
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }} noWrap>{name}</Typography>
          {isAutomated && (
            <Chip
              icon={<SmartToyOutlinedIcon sx={{ fontSize: 14 }} />}
              label="Automated"
              size="small"
              sx={{
                height: 22,
                fontSize: '0.6rem',
                fontWeight: 600,
                bgcolor: alpha(palette.info.main, 0.15),
                color: palette.info.main,
                '& .MuiChip-icon': { color: palette.info.main },
                flexShrink: 0,
              }}
            />
          )}
        </Box>
        <TestRunStatusBadge status={status} />
      </Box>

      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1.5 }}>
        {projectName}{suiteName ? ` / ${suiteName}` : ''}
      </Typography>

      {/* Progress bar */}
      {counts.total > 0 && (
        <Box sx={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', bgcolor: alpha(palette.neutral.main, 0.15), mb: 1.5 }}>
          {counts.pass > 0 && <Box sx={{ width: `${(counts.pass / total) * 100}%`, bgcolor: semanticColors.executionStatus.pass }} />}
          {counts.fail > 0 && <Box sx={{ width: `${(counts.fail / total) * 100}%`, bgcolor: semanticColors.executionStatus.fail }} />}
          {counts.blocked > 0 && <Box sx={{ width: `${(counts.blocked / total) * 100}%`, bgcolor: semanticColors.executionStatus.blocked }} />}
          {counts.skip > 0 && <Box sx={{ width: `${(counts.skip / total) * 100}%`, bgcolor: semanticColors.executionStatus.skip }} />}
          {counts.not_run > 0 && <Box sx={{ width: `${(counts.not_run / total) * 100}%`, bgcolor: semanticColors.executionStatus.not_run }} />}
        </Box>
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {counts.total} cases
          {counts.total > 0 ? ` · ${Math.round((counts.pass / total) * 100)}% pass` : ''}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {(startDate || dueDate) && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {startDate ? new Date(startDate).toLocaleDateString() : ''}
              {startDate && dueDate ? ' – ' : ''}
              {dueDate ? new Date(dueDate).toLocaleDateString() : ''}
            </Typography>
          )}
          {assigneeName && (
            <Avatar src={assigneeAvatar ?? undefined} sx={{ width: 22, height: 22, fontSize: '0.6rem' }}>
              {assigneeName[0]}
            </Avatar>
          )}
        </Box>
      </Box>
    </Box>
  );
}
