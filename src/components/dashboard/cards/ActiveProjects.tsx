'use client';

import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import { alpha } from '@mui/material/styles';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import DashboardCard from '../DashboardCard';
import { palette } from '@/theme/palette';
import type { DashboardActiveProject } from '@/types/database';

const MAX_DISPLAY = 6;

export default function ActiveProjects({
  data,
  index,
}: {
  data: unknown;
  index: number;
}) {
  const router = useRouter();
  const projects = (data as DashboardActiveProject[] | null) ?? [];
  const displayed = projects.slice(0, MAX_DISPLAY);
  const remaining = projects.length - MAX_DISPLAY;

  return (
    <DashboardCard
      title="Active Projects"
      icon={<FolderOutlinedIcon fontSize="small" />}
      loading={data === null}
      isEmpty={projects.length === 0}
      emptyMessage="No active projects"
      index={index}
      span={2}
      action={
        projects.length > 0 ? (
          <Button
            size="small"
            onClick={() => router.push('/projects')}
            sx={{ fontSize: '0.7rem', textTransform: 'none' }}
          >
            View All
          </Button>
        ) : undefined
      }
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
          gap: 1.5,
        }}
      >
        {displayed.map((project) => (
          <Box
            key={project.id}
            onClick={() => router.push(`/projects/${project.id}`)}
            sx={{
              p: 1.5,
              borderRadius: 1.5,
              bgcolor: 'background.default',
              cursor: 'pointer',
              transition: 'background-color 0.15s',
              '&:hover': { bgcolor: palette.background.surface2 },
            }}
          >
            <Typography
              variant="body2"
              sx={{
                fontWeight: 600,
                mb: 0.75,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {project.name}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.75 }}>
              <Chip
                label={`${project.suite_count} suites`}
                size="small"
                sx={{
                  height: 18,
                  fontSize: '0.55rem',
                  fontWeight: 600,
                  bgcolor: alpha(palette.primary.main, 0.1),
                  color: palette.primary.light,
                  '& .MuiChip-label': { px: 0.5 },
                }}
              />
              <Chip
                label={`${project.test_case_count} cases`}
                size="small"
                sx={{
                  height: 18,
                  fontSize: '0.55rem',
                  fontWeight: 600,
                  bgcolor: alpha(palette.success.main, 0.1),
                  color: palette.success.light,
                  '& .MuiChip-label': { px: 0.5 },
                }}
              />
            </Box>
          </Box>
        ))}
      </Box>
      {remaining > 0 && (
        <Typography
          variant="caption"
          sx={{ color: 'text.secondary', mt: 1.5, display: 'block', textAlign: 'center' }}
        >
          +{remaining} more project{remaining > 1 ? 's' : ''}
        </Typography>
      )}
    </DashboardCard>
  );
}
