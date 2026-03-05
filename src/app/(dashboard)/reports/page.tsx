'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import PageTransition from '@/components/animations/PageTransition';
import EmptyState from '@/components/common/EmptyState';
import { useAuth } from '@/components/providers/AuthProvider';
import { alpha } from '@mui/material/styles';
import { palette, semanticColors } from '@/theme/palette';
import type { TestRun } from '@/types/database';

interface RunWithProject extends TestRun {
  projects?: { name: string };
}

const STATUS_COLORS: Record<string, string> = {
  planned: palette.neutral.main,
  in_progress: palette.primary.main,
  completed: palette.success.main,
  aborted: palette.error.main,
};

export default function ReportsPage() {
  const router = useRouter();
  const { isLoading: authLoading } = useAuth();
  const [runs, setRuns] = useState<RunWithProject[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRuns = useCallback(async () => {
    const res = await fetch('/api/test-runs');
    if (res.ok) {
      const data = await res.json();
      setRuns(Array.isArray(data) ? data : []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!authLoading) fetchRuns();
  }, [authLoading, fetchRuns]);

  if (authLoading || loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  const completedRuns = runs.filter(
    (r) => r.status === 'completed' || r.status === 'in_progress',
  );

  return (
    <PageTransition>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>
          Reports
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 4 }}>
          Select a test run to view its execution report with KPIs, platform
          comparison, and status breakdown.
        </Typography>

        {completedRuns.length === 0 ? (
          <EmptyState
            icon={<AssessmentOutlinedIcon sx={{ fontSize: 32 }} />}
            title="No reports available"
            description="Reports are generated from completed or in-progress test runs. Create and execute a test run first."
            showAction={false}
          />
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: 2,
            }}
          >
            {completedRuns.map((run) => (
              <Box
                key={run.id}
                onClick={() => router.push(`/reports/${run.id}`)}
                sx={{
                  p: 3,
                  borderRadius: 2,
                  bgcolor: 'background.paper',
                  border: `1px solid ${palette.divider}`,
                  cursor: 'pointer',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                  '&:hover': {
                    borderColor: palette.primary.main,
                    boxShadow: `0 0 16px ${alpha(palette.primary.main, 0.15)}`,
                  },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Typography variant="body1" sx={{ fontWeight: 600, flex: 1 }}>
                    {run.name}
                  </Typography>
                  <Box
                    sx={{
                      px: 1,
                      py: 0.25,
                      borderRadius: 1,
                      bgcolor: alpha(
                        STATUS_COLORS[run.status] ?? palette.neutral.main,
                        0.15,
                      ),
                      color: STATUS_COLORS[run.status] ?? palette.neutral.main,
                      fontSize: '0.65rem',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                    }}
                  >
                    {run.status.replace('_', ' ')}
                  </Box>
                </Box>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Created{' '}
                  {new Date(run.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </PageTransition>
  );
}
