'use client';

import { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import type { TestCase } from '@/types/database';

interface TestRunCaseSelectorProps {
  open: boolean;
  runId: string;
  projectId: string;
  suiteId: string | null;
  existingCaseIds: string[];
  onClose: () => void;
  onAdded: () => void;
}

export default function TestRunCaseSelector({
  open, runId, projectId, suiteId, existingCaseIds, onClose, onAdded,
}: TestRunCaseSelectorProps) {
  const [cases, setCases] = useState<TestCase[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setSelectedIds([]);

    const fetchCases = async () => {
      if (suiteId) {
        const res = await fetch(`/api/test-cases?suite_id=${suiteId}`);
        if (res.ok) setCases(await res.json());
      } else {
        const suitesRes = await fetch(`/api/projects/${projectId}/suites`);
        if (!suitesRes.ok) return;
        const suites = await suitesRes.json();
        const allCases: TestCase[] = [];
        for (const s of suites) {
          const res = await fetch(`/api/test-cases?suite_id=${s.id}`);
          if (res.ok) {
            const data = await res.json();
            allCases.push(...data);
          }
        }
        setCases(allCases);
      }
      setLoading(false);
    };

    fetchCases();
  }, [open, projectId, suiteId]);

  const toggleCase = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const handleAdd = async () => {
    if (selectedIds.length === 0) return;
    setSaving(true);
    try {
      await fetch(`/api/test-runs/${runId}/cases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test_case_ids: selectedIds }),
      });
      onAdded();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const availableCases = cases.filter((c) => !existingCaseIds.includes(c.id));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Add Test Cases</DialogTitle>
      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
        ) : availableCases.length === 0 ? (
          <Typography sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>
            {cases.length === 0 ? 'No test cases found in this project' : 'All test cases are already added'}
          </Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" />
                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>ID</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Title</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Platforms</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {availableCases.map((tc) => (
                <TableRow key={tc.id} hover sx={{ cursor: 'pointer' }} onClick={() => toggleCase(tc.id)}>
                  <TableCell padding="checkbox">
                    <Checkbox checked={selectedIds.includes(tc.id)} size="small" />
                  </TableCell>
                  <TableCell>
                    <Chip label={tc.display_id} size="small" variant="outlined" sx={{ fontFamily: 'monospace', fontSize: '0.7rem', height: 22 }} />
                  </TableCell>
                  <TableCell><Typography variant="body2">{tc.title}</Typography></TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      {tc.platform_tags.map((p) => (
                        <Chip key={p} label={p} size="small" sx={{ height: 18, fontSize: '0.55rem' }} />
                      ))}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={saving}>Cancel</Button>
        <Button onClick={handleAdd} variant="contained" disabled={saving || selectedIds.length === 0}>
          {saving ? 'Adding...' : `Add ${selectedIds.length} Case${selectedIds.length !== 1 ? 's' : ''}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
