'use client';

import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import CircularProgress from '@mui/material/CircularProgress';
import AddIcon from '@mui/icons-material/Add';
import PlaylistPlayIcon from '@mui/icons-material/PlaylistPlay';
import PageTransition from '@/components/animations/PageTransition';
import TestRunCard from '@/components/test-runs/TestRunCard';
import CreateTestRunDialog from '@/components/test-runs/CreateTestRunDialog';
import EmptyState from '@/components/common/EmptyState';
import { useAuth } from '@/components/providers/AuthProvider';
import type { Project } from '@/types/database';

interface RunData {
  id: string;
  name: string;
  status: 'planned' | 'in_progress' | 'completed' | 'aborted';
  project_id: string;
  start_date: string | null;
  due_date: string | null;
  is_automated: boolean;
  projects: { name: string } | null;
  suites: { name: string; prefix: string } | null;
  assignee: { full_name: string; avatar_url: string | null } | null;
  counts: { total: number; pass: number; fail: number; blocked: number; skip: number; not_run: number };
}

export default function RunsListPage() {
  const { can, isLoading: authLoading } = useAuth();
  const [runs, setRuns] = useState<RunData[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [filterProject, setFilterProject] = useState('');
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const canWrite = can('write');

  const fetchRuns = useCallback(async () => {
    const url = filterProject ? `/api/test-runs?project_id=${filterProject}` : '/api/test-runs';
    const res = await fetch(url);
    if (res.ok) setRuns(await res.json());
  }, [filterProject]);

  const fetchProjects = useCallback(async () => {
    const res = await fetch('/api/projects');
    if (res.ok) setProjects(await res.json());
  }, []);

  useEffect(() => {
    if (!authLoading) {
      Promise.all([fetchRuns(), fetchProjects()]).finally(() => setLoading(false));
    }
  }, [authLoading, fetchRuns, fetchProjects]);

  useEffect(() => {
    if (!authLoading && !loading) fetchRuns();
  }, [filterProject]); // eslint-disable-line react-hooks/exhaustive-deps

  if (authLoading || loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}><CircularProgress /></Box>;
  }

  return (
    <PageTransition>
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>Test Runs</Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Project</InputLabel>
              <Select value={filterProject} onChange={(e) => setFilterProject(e.target.value)} label="Project">
                <MenuItem value="">All Projects</MenuItem>
                {projects.map((p) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
              </Select>
            </FormControl>
            {canWrite && (
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
                New Run
              </Button>
            )}
          </Box>
        </Box>

        {runs.length === 0 ? (
          <EmptyState
            icon={<PlaylistPlayIcon sx={{ fontSize: 32 }} />}
            title="No test runs yet"
            description="Create a test run to start tracking execution results across platforms."
            actionLabel="New Run"
            onAction={() => setCreateOpen(true)}
            showAction={canWrite}
          />
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }, gap: 2 }}>
            {runs.map((run) => (
              <TestRunCard
                key={run.id}
                id={run.id}
                name={run.name}
                status={run.status}
                projectName={run.projects?.name ?? 'Unknown'}
                suiteName={run.suites?.name ?? null}
                assigneeName={run.assignee?.full_name ?? null}
                assigneeAvatar={run.assignee?.avatar_url ?? null}
                startDate={run.start_date}
                dueDate={run.due_date}
                counts={run.counts}
                isAutomated={run.is_automated}
              />
            ))}
          </Box>
        )}

        <CreateTestRunDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={fetchRuns} />
      </Box>
    </PageTransition>
  );
}
