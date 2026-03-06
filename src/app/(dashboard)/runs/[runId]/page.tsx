'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Avatar from '@mui/material/Avatar';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckIcon from '@mui/icons-material/Check';
import StopIcon from '@mui/icons-material/Stop';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import NextLink from 'next/link';
import { alpha } from '@mui/material/styles';
import PageTransition from '@/components/animations/PageTransition';
import TestRunStatusBadge from '@/components/test-runs/TestRunStatusBadge';
import TestRunCaseSelector from '@/components/test-runs/TestRunCaseSelector';
import StatusBadge from '@/components/execution/StatusBadge';
import CombinedStatusDisplay from '@/components/execution/CombinedStatusDisplay';
import { useAuth } from '@/components/providers/AuthProvider';
import { palette, semanticColors } from '@/theme/palette';
import type { TestRunStatus, ExecutionStatus } from '@/types/database';

interface RunDetail {
  id: string;
  name: string;
  description: string | null;
  status: TestRunStatus;
  target_version: string | null;
  environment: string | null;
  start_date: string | null;
  due_date: string | null;
  project_id: string;
  suite_id: string | null;
  projects: { id: string; name: string } | null;
  suites: { id: string; name: string; prefix: string } | null;
  assignee: { id: string; full_name: string; avatar_url: string | null } | null;
}

interface RunCase {
  id: string;
  test_case_id: string;
  overall_status: ExecutionStatus;
  test_cases: {
    id: string;
    display_id: string;
    title: string;
    platform_tags: string[];
    suites: { prefix: string; name: string } | null;
  } | null;
  platform_status: Record<string, string>;
}

export default function RunDetailPage() {
  const params = useParams();
  const router = useRouter();
  const runId = params.runId as string;
  const { can, isLoading: authLoading } = useAuth();

  const [run, setRun] = useState<RunDetail | null>(null);
  const [cases, setCases] = useState<RunCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectorOpen, setSelectorOpen] = useState(false);

  const canWrite = can('write');

  const fetchRun = useCallback(async () => {
    const res = await fetch(`/api/test-runs/${runId}`);
    if (res.ok) setRun(await res.json());
    else router.push('/runs');
  }, [runId, router]);

  const fetchCases = useCallback(async () => {
    const res = await fetch(`/api/test-runs/${runId}/cases`);
    if (res.ok) setCases(await res.json());
  }, [runId]);

  useEffect(() => {
    if (!authLoading) {
      Promise.all([fetchRun(), fetchCases()]).finally(() => setLoading(false));
    }
  }, [authLoading, fetchRun, fetchCases]);

  const handleStatusChange = async (newStatus: TestRunStatus) => {
    await fetch(`/api/test-runs/${runId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    fetchRun();
  };

  const handleCasesAdded = () => {
    fetchCases();
    fetchRun();
  };

  if (authLoading || loading || !run) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}><CircularProgress /></Box>;
  }

  const counts = { total: cases.length, pass: 0, fail: 0, blocked: 0, skip: 0, not_run: 0 };
  for (const c of cases) {
    const s = c.overall_status as keyof typeof counts;
    if (s !== 'total' && s in counts) (counts as Record<string, number>)[s]++;
  }
  const passRate = counts.total > 0 ? Math.round((counts.pass / counts.total) * 100) : 0;

  return (
    <PageTransition>
      <Box>
        <Breadcrumbs sx={{ mb: 2 }}>
          <Link component={NextLink} href="/runs" underline="hover" color="text.secondary" fontSize="0.875rem">Test Runs</Link>
          <Typography fontSize="0.875rem" color="text.primary">{run.name}</Typography>
        </Breadcrumbs>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <IconButton onClick={() => router.push('/runs')} size="small" sx={{ color: 'text.secondary' }}>
            <ArrowBackIcon fontSize="small" />
          </IconButton>
          <Typography variant="h4" sx={{ fontWeight: 700, flex: 1 }}>{run.name}</Typography>
          <TestRunStatusBadge status={run.status} size="medium" />
        </Box>

        {/* Metadata */}
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
          {run.projects && <Chip label={run.projects.name} size="small" variant="outlined" />}
          {run.suites && <Chip label={`${run.suites.prefix} - ${run.suites.name}`} size="small" variant="outlined" />}
          {run.target_version && <Chip label={`v${run.target_version}`} size="small" variant="outlined" />}
          {run.environment && <Chip label={run.environment} size="small" variant="outlined" />}
          {run.assignee && (
            <Chip
              avatar={<Avatar src={run.assignee.avatar_url ?? undefined} sx={{ width: 20, height: 20 }}>{run.assignee.full_name[0]}</Avatar>}
              label={run.assignee.full_name}
              size="small"
              variant="outlined"
            />
          )}
        </Box>

        {/* Description / CI Link */}
        {run.description && (() => {
          const urlMatch = run.description.match(/(https?:\/\/[^\s]+)/);
          return (
            <Box sx={{ mb: 2 }}>
              {urlMatch ? (
                <Chip
                  icon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
                  label="CI Build"
                  size="small"
                  component="a"
                  href={urlMatch[1]}
                  target="_blank"
                  rel="noopener noreferrer"
                  clickable
                  sx={{
                    bgcolor: alpha(palette.info.main, 0.12),
                    color: palette.info.main,
                    mr: 1,
                  }}
                />
              ) : null}
              <Typography variant="body2" component="span" sx={{ color: 'text.secondary' }}>
                {run.description}
              </Typography>
            </Box>
          );
        })()}

        {/* Status controls */}
        {canWrite && (
          <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
            {run.status === 'planned' && (
              <Button size="small" variant="contained" startIcon={<PlayArrowIcon />} onClick={() => handleStatusChange('in_progress')}>
                Start Run
              </Button>
            )}
            {run.status === 'in_progress' && (
              <>
                <Button size="small" variant="contained" color="success" startIcon={<CheckIcon />} onClick={() => handleStatusChange('completed')}>
                  Complete
                </Button>
                <Button size="small" variant="outlined" color="error" startIcon={<StopIcon />} onClick={() => handleStatusChange('aborted')}>
                  Abort
                </Button>
              </>
            )}
            {(run.status === 'completed' || run.status === 'aborted') && (
              <Button size="small" variant="outlined" startIcon={<PlayArrowIcon />} onClick={() => handleStatusChange('in_progress')}>
                Re-open Run
              </Button>
            )}
          </Box>
        )}

        {/* Summary bar */}
        {counts.total > 0 && (
          <Box sx={{ mb: 3, p: 2, borderRadius: '8px', bgcolor: 'background.paper', border: `1px solid ${palette.divider}` }}>
            <Box sx={{ display: 'flex', gap: 3, mb: 1.5, flexWrap: 'wrap' }}>
              <Typography variant="body2"><strong>{counts.total}</strong> cases</Typography>
              <Typography variant="body2" sx={{ color: semanticColors.executionStatus.pass }}><strong>{counts.pass}</strong> pass</Typography>
              <Typography variant="body2" sx={{ color: semanticColors.executionStatus.fail }}><strong>{counts.fail}</strong> fail</Typography>
              <Typography variant="body2" sx={{ color: semanticColors.executionStatus.blocked }}><strong>{counts.blocked}</strong> blocked</Typography>
              <Typography variant="body2" sx={{ color: semanticColors.executionStatus.not_run }}><strong>{counts.not_run}</strong> not run</Typography>
              <Typography variant="body2" sx={{ ml: 'auto', fontWeight: 600 }}>{passRate}% pass rate</Typography>
            </Box>
            <Box sx={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', bgcolor: alpha(palette.neutral.main, 0.15) }}>
              {counts.pass > 0 && <Box sx={{ width: `${(counts.pass / counts.total) * 100}%`, bgcolor: semanticColors.executionStatus.pass }} />}
              {counts.fail > 0 && <Box sx={{ width: `${(counts.fail / counts.total) * 100}%`, bgcolor: semanticColors.executionStatus.fail }} />}
              {counts.blocked > 0 && <Box sx={{ width: `${(counts.blocked / counts.total) * 100}%`, bgcolor: semanticColors.executionStatus.blocked }} />}
              {counts.skip > 0 && <Box sx={{ width: `${(counts.skip / counts.total) * 100}%`, bgcolor: semanticColors.executionStatus.skip }} />}
              {counts.not_run > 0 && <Box sx={{ width: `${(counts.not_run / counts.total) * 100}%`, bgcolor: semanticColors.executionStatus.not_run }} />}
            </Box>
          </Box>
        )}

        <Divider sx={{ mb: 3 }} />

        {/* Cases list */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>Test Cases ({cases.length})</Typography>
          {canWrite && (
            <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={() => setSelectorOpen(true)}>
              Add Cases
            </Button>
          )}
        </Box>

        {cases.length === 0 ? (
          <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 4 }}>
            No test cases added yet. Click &quot;Add Cases&quot; to select test cases for this run.
          </Typography>
        ) : (
          <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', bgcolor: 'background.paper', overflow: 'hidden' }}>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', width: 100 }}>ID</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>Title</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', width: 180 }}>Platform Status</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', width: 100 }}>Overall</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {cases.map((trc) => (
                    <TableRow
                      key={trc.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => router.push(`/runs/${runId}/execute/${trc.test_case_id}`)}
                    >
                      <TableCell>
                        <Chip label={trc.test_cases?.display_id ?? '??'} size="small" variant="outlined" sx={{ fontFamily: 'monospace', fontSize: '0.7rem', height: 22 }} />
                      </TableCell>
                      <TableCell><Typography variant="body2">{trc.test_cases?.title ?? 'Unknown'}</Typography></TableCell>
                      <TableCell><CombinedStatusDisplay platformStatus={trc.platform_status} /></TableCell>
                      <TableCell><StatusBadge status={trc.overall_status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        <TestRunCaseSelector
          open={selectorOpen}
          runId={runId}
          projectId={run.project_id}
          suiteId={run.suite_id}
          existingCaseIds={cases.map((c) => c.test_case_id)}
          onClose={() => setSelectorOpen(false)}
          onAdded={handleCasesAdded}
        />
      </Box>
    </PageTransition>
  );
}
