'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import CircularProgress from '@mui/material/CircularProgress';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import NextLink from 'next/link';
import { alpha } from '@mui/material/styles';
import { palette } from '@/theme/palette';
import PageTransition from '@/components/animations/PageTransition';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Button from '@mui/material/Button';
import AddIcon from '@mui/icons-material/Add';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import ExecutionMatrix, { type ResultMap, type BrowserResultMap, type ResultEntry } from '@/components/execution/ExecutionMatrix';
import AnnotationPanel from '@/components/execution/AnnotationPanel';
import { useAuth } from '@/components/providers/AuthProvider';
import type { TestCase, TestStep, ExecutionStatus, Platform, ExecutionResult } from '@/types/database';

export default function ExecuteCasePage() {
  const params = useParams();
  const router = useRouter();
  const runId = params.runId as string;
  const caseId = params.caseId as string;
  const { can, isLoading: authLoading } = useAuth();

  const [testCase, setTestCase] = useState<TestCase | null>(null);
  const [steps, setSteps] = useState<TestStep[]>([]);
  const [browserResults, setBrowserResults] = useState<BrowserResultMap>({});
  const [browsers, setBrowsers] = useState<string[]>(['default']);
  const [selectedBrowser, setSelectedBrowser] = useState('default');
  const [runName, setRunName] = useState('');
  const [projectId, setProjectId] = useState('');
  const [runStatus, setRunStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [failedResultIds, setFailedResultIds] = useState<Record<string, string>>({});
  const [addBrowserOpen, setAddBrowserOpen] = useState(false);
  const [newBrowserName, setNewBrowserName] = useState('');

  const readOnly = !can('write');

  const fetchData = useCallback(async () => {
    const [tcRes, runRes, resultsRes] = await Promise.all([
      fetch(`/api/test-cases/${caseId}`),
      fetch(`/api/test-runs/${runId}`),
      fetch(`/api/test-runs/${runId}/results?case_id=${caseId}`),
    ]);

    if (tcRes.ok) {
      const tc = await tcRes.json();
      setTestCase(tc);
      setSteps(
        (tc.test_steps ?? []).sort(
          (a: TestStep, b: TestStep) => a.step_number - b.step_number,
        ),
      );
    }
    if (runRes.ok) {
      const run = await runRes.json();
      setRunName(run.name);
      setProjectId(run.project_id);
      setRunStatus(run.status);
    }
    if (resultsRes.ok) {
      const data: ExecutionResult[] = await resultsRes.json();
      const bMap: BrowserResultMap = {};
      const failedIds: Record<string, string> = {};
      const browserSet = new Set<string>();
      for (const r of data) {
        const browser = r.browser || 'default';
        browserSet.add(browser);
        if (!bMap[r.test_step_id]) bMap[r.test_step_id] = {};
        if (!bMap[r.test_step_id][r.platform]) bMap[r.test_step_id][r.platform] = {};
        bMap[r.test_step_id][r.platform][browser] = { status: r.status, id: r.id, comment: r.comment };
        if (r.status === 'fail') {
          failedIds[`${r.test_step_id}_${r.platform}_${browser}`] = r.id;
        }
      }
      setBrowserResults(bMap);
      const bList = browserSet.size > 0 ? Array.from(browserSet).sort() : ['default'];
      setBrowsers(bList);
      if (!browserSet.has(selectedBrowser)) setSelectedBrowser(bList[0]);
      setFailedResultIds(failedIds);
    }
    setLoading(false);
  }, [runId, caseId]);

  useEffect(() => {
    if (!authLoading) fetchData();
  }, [authLoading, fetchData]);

  const handleStatusChange = async (stepId: string, platform: Platform, newStatus: ExecutionStatus, comment?: string | null) => {
    if (!testCase) return;

    setBrowserResults((prev) => {
      const prev_entry = prev[stepId]?.[platform]?.[selectedBrowser] ?? {} as ResultEntry;
      return {
        ...prev,
        [stepId]: {
          ...prev[stepId],
          [platform]: {
            ...prev[stepId]?.[platform],
            [selectedBrowser]: {
              ...prev_entry,
              status: newStatus,
              comment: comment !== undefined ? comment : prev_entry.comment,
            },
          },
        },
      };
    });

    const currentComment = browserResults[stepId]?.[platform]?.[selectedBrowser]?.comment;
    await fetch(`/api/test-runs/${runId}/results`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        results: [{
          test_case_id: caseId,
          test_step_id: stepId,
          platform,
          browser: selectedBrowser,
          status: newStatus,
          comment: comment !== undefined ? comment : currentComment ?? null,
        }],
      }),
    });

    if (runStatus === 'planned') {
      await fetch(`/api/test-runs/${runId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'in_progress' }),
      });
      setRunStatus('in_progress');
    }

    await fetch(`/api/test-runs/${runId}/status`, { method: 'PATCH' });

    const resultsRes = await fetch(`/api/test-runs/${runId}/results?case_id=${caseId}`);
    if (resultsRes.ok) {
      const data: ExecutionResult[] = await resultsRes.json();
      const failedIds: Record<string, string> = {};
      for (const r of data) {
        if (r.status === 'fail') {
          failedIds[`${r.test_step_id}_${r.platform}_${r.browser || 'default'}`] = r.id;
        }
      }
      setFailedResultIds(failedIds);
    }
  };

  const handleCommentChange = (stepId: string, platform: Platform, comment: string) => {
    setBrowserResults((prev) => {
      const prev_entry = prev[stepId]?.[platform]?.[selectedBrowser] ?? {} as ResultEntry;
      return {
        ...prev,
        [stepId]: {
          ...prev[stepId],
          [platform]: {
            ...prev[stepId]?.[platform],
            [selectedBrowser]: { ...prev_entry, comment },
          },
        },
      };
    });
  };

  const handleAddBrowser = () => {
    const name = newBrowserName.trim();
    if (name && !browsers.includes(name)) {
      setBrowsers((prev) => [...prev, name].sort());
      setSelectedBrowser(name);
    }
    setNewBrowserName('');
    setAddBrowserOpen(false);
  };

  const currentResults: ResultMap = {};
  for (const [stepId, platforms] of Object.entries(browserResults)) {
    currentResults[stepId] = {};
    for (const [platform, browserMap] of Object.entries(platforms)) {
      const entry = browserMap[selectedBrowser];
      if (entry) currentResults[stepId][platform] = entry;
    }
  }

  if (authLoading || loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}><CircularProgress /></Box>;
  }

  if (!testCase) return null;

  const platforms = (testCase.platform_tags.length > 0 ? testCase.platform_tags : ['desktop']) as Platform[];

  return (
    <PageTransition>
      <Box>
        <Breadcrumbs sx={{ mb: 2 }}>
          <Link component={NextLink} href="/runs" underline="hover" color="text.secondary" fontSize="0.875rem">Test Runs</Link>
          <Link component={NextLink} href={`/runs/${runId}`} underline="hover" color="text.secondary" fontSize="0.875rem">{runName}</Link>
          <Typography fontSize="0.875rem" color="text.primary">{testCase.display_id}</Typography>
        </Breadcrumbs>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <IconButton onClick={() => router.push(`/runs/${runId}`)} size="small" sx={{ color: 'text.secondary' }}>
            <ArrowBackIcon fontSize="small" />
          </IconButton>
          <Chip label={testCase.display_id} variant="outlined" sx={{ fontFamily: 'monospace', fontWeight: 600 }} />
          <Typography variant="h5" sx={{ fontWeight: 700, flex: 1 }}>{testCase.title}</Typography>
        </Box>

        {testCase.precondition && (
          <Box sx={{ mb: 2, p: 2, borderRadius: '8px', bgcolor: alpha(palette.warning.main, 0.06), border: `1px solid ${alpha(palette.warning.main, 0.2)}` }}>
            <Typography variant="caption" sx={{ fontWeight: 600, color: palette.warning.main }}>Precondition</Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>{testCase.precondition}</Typography>
          </Box>
        )}

        {testCase.description && (
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>{testCase.description}</Typography>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Browser:</Typography>
          <Tabs
            value={selectedBrowser}
            onChange={(_, val) => setSelectedBrowser(val)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              minHeight: 32,
              flex: 1,
              '& .MuiTab-root': { minHeight: 32, fontSize: '0.8rem', textTransform: 'none', py: 0 },
            }}
          >
            {browsers.map((b) => (
              <Tab key={b} value={b} label={b === 'default' ? 'Default' : b} />
            ))}
          </Tabs>
          {!readOnly && (
            <Button size="small" startIcon={<AddIcon />} onClick={() => setAddBrowserOpen(true)} sx={{ whiteSpace: 'nowrap' }}>
              Add Browser
            </Button>
          )}
        </Box>

        <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', bgcolor: 'background.paper', overflow: 'hidden' }}>
          <ExecutionMatrix
            steps={steps}
            platforms={platforms}
            results={currentResults}
            browsers={browsers}
            selectedBrowser={selectedBrowser}
            onBrowserChange={setSelectedBrowser}
            onStatusChange={handleStatusChange}
            onCommentChange={handleCommentChange}
            readOnly={readOnly}
          />
        </Box>

        {Object.keys(failedResultIds).length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>Failure Annotations</Typography>
            {Object.entries(failedResultIds).map(([key, resultId]) => {
              const parts = key.split('_');
              const stepId = parts[0];
              const platform = parts[1];
              const browser = parts.slice(2).join('_') || 'default';
              const step = steps.find((s) => s.id === stepId);
              return (
                <Box key={key} sx={{ mb: 2 }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', mb: 0.5, display: 'block' }}>
                    Step {step?.step_number ?? '?'}: {step?.description?.slice(0, 60) ?? ''} ({platform}{browser !== 'default' ? ` / ${browser}` : ''})
                  </Typography>
                  <AnnotationPanel
                    executionResultId={resultId}
                    projectId={projectId}
                    testRunId={runId}
                    readOnly={readOnly}
                  />
                </Box>
              );
            })}
          </Box>
        )}

        <Dialog open={addBrowserOpen} onClose={() => setAddBrowserOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle>Add Browser</DialogTitle>
          <DialogContent>
            <TextField
              label="Browser Name"
              value={newBrowserName}
              onChange={(e) => setNewBrowserName(e.target.value)}
              fullWidth
              placeholder="e.g. Chrome, Safari, Firefox"
              sx={{ mt: 1 }}
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddBrowser(); }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAddBrowserOpen(false)} color="inherit">Cancel</Button>
            <Button onClick={handleAddBrowser} variant="contained" disabled={!newBrowserName.trim()}>Add</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </PageTransition>
  );
}
