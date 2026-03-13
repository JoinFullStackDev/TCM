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
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import Popover from '@mui/material/Popover';
import FormGroup from '@mui/material/FormGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemText from '@mui/material/ListItemText';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckIcon from '@mui/icons-material/Check';
import StopIcon from '@mui/icons-material/Stop';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DevicesIcon from '@mui/icons-material/Devices';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import PersonOffOutlinedIcon from '@mui/icons-material/PersonOffOutlined';
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
  source: string;
  gitlab_pipeline_url: string | null;
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
  const canDelete = can('delete');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [envAnchor, setEnvAnchor] = useState<HTMLElement | null>(null);
  const [assigneeAnchor, setAssigneeAnchor] = useState<HTMLElement | null>(null);
  const [profilesList, setProfilesList] = useState<{ id: string; full_name: string | null; avatar_url: string | null; role: string }[]>([]);
  const [profilesLoaded, setProfilesLoaded] = useState(false);
  const [projectPlatforms, setProjectPlatforms] = useState<string[]>([]);

  const currentPlatforms = run?.environment
    ? run.environment.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  const allPlatforms = [...new Set([...projectPlatforms, ...currentPlatforms, 'Desktop', 'Tablet', 'Mobile'])];

  useEffect(() => {
    if (run?.project_id) {
      fetch(`/api/projects/${run.project_id}/test-cases`)
        .then((r) => r.ok ? r.json() : [])
        .then((cases: { platform_tags?: string[] }[]) => {
          const platforms = new Set<string>();
          for (const tc of cases) {
            for (const p of tc.platform_tags ?? []) {
              platforms.add(p.charAt(0).toUpperCase() + p.slice(1));
            }
          }
          setProjectPlatforms([...platforms]);
        });
    }
  }, [run?.project_id]);

  const handlePlatformToggle = async (platform: string) => {
    const updated = currentPlatforms.includes(platform)
      ? currentPlatforms.filter((p) => p !== platform)
      : [...currentPlatforms, platform];
    const newEnv = updated.join(', ');
    await fetch(`/api/test-runs/${runId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ environment: newEnv || null }),
    });
    fetchRun();
  };

  const handleAssigneeOpen = async (e: React.MouseEvent<HTMLElement>) => {
    setAssigneeAnchor(e.currentTarget);
    if (!profilesLoaded) {
      const res = await fetch('/api/profiles');
      if (res.ok) setProfilesList(await res.json());
      setProfilesLoaded(true);
    }
  };

  const handleAssigneeChange = async (userId: string | null) => {
    setAssigneeAnchor(null);
    await fetch(`/api/test-runs/${runId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignee_id: userId }),
    });
    fetchRun();
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    const res = await fetch(`/api/test-runs/${runId}`, { method: 'DELETE' });
    setDeleteLoading(false);
    if (res.ok) router.push('/runs');
  };

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
          {run.source === 'ci_trigger' && run.gitlab_pipeline_url && (
            <Chip
              icon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
              label="View Pipeline"
              size="small"
              component="a"
              href={run.gitlab_pipeline_url}
              target="_blank"
              rel="noopener noreferrer"
              clickable
              sx={{
                bgcolor: alpha(palette.info.main, 0.12),
                color: palette.info.main,
              }}
            />
          )}
          {run.target_version && <Chip label={`v${run.target_version}`} size="small" variant="outlined" />}
          {canWrite ? (
            <Chip
              icon={<DevicesIcon sx={{ fontSize: 14 }} />}
              label={run.environment || 'Add Platforms'}
              size="small"
              variant="outlined"
              onClick={(e) => setEnvAnchor(e.currentTarget)}
              sx={{ cursor: 'pointer' }}
            />
          ) : (
            run.environment && <Chip label={run.environment} size="small" variant="outlined" />
          )}
          {canWrite ? (
            <Chip
              icon={run.assignee ? undefined : <PersonOutlineIcon sx={{ fontSize: 14 }} />}
              avatar={run.assignee ? <Avatar src={run.assignee.avatar_url ?? undefined} sx={{ width: 20, height: 20 }}>{run.assignee.full_name[0]}</Avatar> : undefined}
              label={run.assignee ? run.assignee.full_name : 'Assign'}
              size="small"
              variant="outlined"
              onClick={handleAssigneeOpen}
              sx={{ cursor: 'pointer' }}
            />
          ) : (
            run.assignee && (
              <Chip
                avatar={<Avatar src={run.assignee.avatar_url ?? undefined} sx={{ width: 20, height: 20 }}>{run.assignee.full_name[0]}</Avatar>}
                label={run.assignee.full_name}
                size="small"
                variant="outlined"
              />
            )
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
            {canDelete && (
              <>
                <Box sx={{ flex: 1 }} />
                <Button size="small" variant="outlined" color="error" startIcon={<DeleteOutlineIcon />} onClick={() => setDeleteOpen(true)}>
                  Delete Run
                </Button>
              </>
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

        <Popover
          open={Boolean(envAnchor)}
          anchorEl={envAnchor}
          onClose={() => setEnvAnchor(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          slotProps={{ paper: { sx: { p: 1.5, minWidth: 160 } } }}
        >
          <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', display: 'block', mb: 0.5, px: 0.5 }}>
            Platforms
          </Typography>
          <FormGroup>
            {allPlatforms.map((platform) => {
              const usedInProject = projectPlatforms.includes(platform);
              return (
                <FormControlLabel
                  key={platform}
                  control={
                    <Checkbox
                      size="small"
                      checked={currentPlatforms.includes(platform)}
                      onChange={() => handlePlatformToggle(platform)}
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography variant="body2">{platform}</Typography>
                      {usedInProject && (
                        <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.6rem' }}>
                          (in project)
                        </Typography>
                      )}
                    </Box>
                  }
                  sx={{ mx: 0 }}
                />
              );
            })}
          </FormGroup>
        </Popover>

        <Popover
          open={Boolean(assigneeAnchor)}
          anchorEl={assigneeAnchor}
          onClose={() => setAssigneeAnchor(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          slotProps={{ paper: { sx: { minWidth: 220, maxHeight: 320 } } }}
        >
          <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', display: 'block', px: 2, pt: 1.5, pb: 0.5 }}>
            Assign to
          </Typography>
          <List dense sx={{ py: 0.5 }}>
            {run.assignee && (
              <ListItemButton onClick={() => handleAssigneeChange(null)} sx={{ py: 0.75 }}>
                <ListItemAvatar sx={{ minWidth: 36 }}>
                  <PersonOffOutlinedIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                </ListItemAvatar>
                <ListItemText
                  primary="Unassign"
                  primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
                />
              </ListItemButton>
            )}
            {profilesList.map((p) => {
              const isSelected = run.assignee?.id === p.id;
              return (
                <ListItemButton
                  key={p.id}
                  onClick={() => handleAssigneeChange(p.id)}
                  selected={isSelected}
                  sx={{ py: 0.75 }}
                >
                  <ListItemAvatar sx={{ minWidth: 36 }}>
                    <Avatar
                      src={p.avatar_url ?? undefined}
                      sx={{ width: 24, height: 24, fontSize: '0.7rem' }}
                    >
                      {p.full_name?.[0] ?? '?'}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={p.full_name ?? 'Unknown'}
                    primaryTypographyProps={{ variant: 'body2', fontWeight: isSelected ? 600 : 400 }}
                  />
                  {isSelected && <CheckIcon sx={{ fontSize: 16, color: 'primary.main' }} />}
                </ListItemButton>
              );
            })}
            {!profilesLoaded && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <CircularProgress size={20} />
              </Box>
            )}
          </List>
        </Popover>

        <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
          <DialogTitle>Delete Test Run</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to delete <strong>{run.name}</strong>? This will permanently remove the run and all its execution results. This cannot be undone.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteOpen(false)} disabled={deleteLoading}>Cancel</Button>
            <Button onClick={handleDelete} color="error" variant="contained" disabled={deleteLoading}>
              {deleteLoading ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </PageTransition>
  );
}
