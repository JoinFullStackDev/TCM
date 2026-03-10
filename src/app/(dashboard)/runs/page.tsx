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
import PageTransition from '@/components/animations/PageTransition';
import TestRunDataGrid from '@/components/test-runs/TestRunDataGrid';
import CreateTestRunDialog from '@/components/test-runs/CreateTestRunDialog';
import { useAuth } from '@/components/providers/AuthProvider';
import type { RunRow } from '@/components/test-runs/TestRunDataGrid';
import type { Project } from '@/types/database';

export default function RunsListPage() {
  const { can, isLoading: authLoading } = useAuth();
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [filterProject, setFilterProject] = useState('');
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const canWrite = can('write');
  const canDelete = can('delete');

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

  const handleDelete = useCallback(async (id: string) => {
    const res = await fetch(`/api/test-runs/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setRuns((prev) => prev.filter((r) => r.id !== id));
    }
  }, []);

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

        <TestRunDataGrid
          rows={runs}
          loading={false}
          canDelete={canDelete}
          onDelete={handleDelete}
        />

        <CreateTestRunDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={fetchRuns} />
      </Box>
    </PageTransition>
  );
}
