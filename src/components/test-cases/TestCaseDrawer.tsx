'use client';

import { useState, useEffect, useCallback } from 'react';
import Drawer from '@mui/material/Drawer';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import CloseIcon from '@mui/icons-material/Close';
import { alpha } from '@mui/material/styles';
import { palette } from '@/theme/palette';
import StepEditor, { type StepData } from './StepEditor';
import BugLinksList from './BugLinksList';
import type {
  TestCase,
  AutomationStatus,
  TestCaseType,
  TestCaseCategory,
  Platform,
  Priority,
} from '@/types/database';

interface TestCaseDrawerProps {
  open: boolean;
  testCaseId: string | null;
  suiteId: string;
  projectId?: string;
  createMode: boolean;
  readOnly: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const AUTOMATION_OPTIONS: { value: AutomationStatus; label: string }[] = [
  { value: 'not_automated', label: 'Not Automated' },
  { value: 'scripted', label: 'Scripted' },
  { value: 'in_cicd', label: 'In CICD' },
  { value: 'out_of_sync', label: 'Out of Sync' },
];

const TYPE_OPTIONS: { value: TestCaseType; label: string }[] = [
  { value: 'functional', label: 'Functional' },
  { value: 'performance', label: 'Performance' },
];

const PLATFORM_OPTIONS: { value: Platform; label: string }[] = [
  { value: 'desktop', label: 'Desktop' },
  { value: 'tablet', label: 'Tablet' },
  { value: 'mobile', label: 'Mobile' },
];

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const CATEGORY_OPTIONS: { value: TestCaseCategory; label: string }[] = [
  { value: 'smoke', label: 'Smoke' },
  { value: 'regression', label: 'Regression' },
  { value: 'integration', label: 'Integration' },
  { value: 'e2e', label: 'E2E' },
  { value: 'unit', label: 'Unit' },
  { value: 'acceptance', label: 'Acceptance' },
  { value: 'exploratory', label: 'Exploratory' },
  { value: 'performance', label: 'Performance' },
  { value: 'security', label: 'Security' },
  { value: 'usability', label: 'Usability' },
];

export default function TestCaseDrawer({
  open,
  testCaseId,
  suiteId,
  projectId,
  createMode,
  readOnly,
  onClose,
  onSaved,
}: TestCaseDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [precondition, setPrecondition] = useState('');
  const [type, setType] = useState<TestCaseType>('functional');
  const [automationStatus, setAutomationStatus] = useState<AutomationStatus>('not_automated');
  const [automationFilePath, setAutomationFilePath] = useState('');
  const [platformTags, setPlatformTags] = useState<Platform[]>([]);
  const [priority, setPriority] = useState<Priority | ''>('');
  const [category, setCategory] = useState<TestCaseCategory | ''>('');
  const [tags, setTags] = useState('');
  const [responseTimeThreshold, setResponseTimeThreshold] = useState('');
  const [throughputTarget, setThroughputTarget] = useState('');
  const [steps, setSteps] = useState<StepData[]>([]);

  const [displayId, setDisplayId] = useState('');
  const [versions, setVersions] = useState<Array<{
    id: string;
    version_number: number;
    changed_by: string;
    change_summary: string | null;
    created_at: string;
    changer?: { full_name: string } | null;
  }>>([]);

  const fetchTestCase = useCallback(async () => {
    if (!testCaseId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/test-cases/${testCaseId}`);
      if (!res.ok) return;
      const data = await res.json();
      const tc = data as TestCase & {
        test_steps: StepData[];
        test_case_versions: typeof versions;
      };
      setTitle(tc.title);
      setDescription(tc.description ?? '');
      setPrecondition(tc.precondition ?? '');
      setType(tc.type);
      setAutomationStatus(tc.automation_status);
      setAutomationFilePath(tc.automation_file_path ?? '');
      setPlatformTags(tc.platform_tags);
      setPriority(tc.priority ?? '');
      setCategory(tc.category ?? '');
      setTags(tc.tags.join(', '));
      const meta = tc.metadata as Record<string, unknown> ?? {};
      setResponseTimeThreshold(String(meta.response_time_threshold_ms ?? ''));
      setThroughputTarget(String(meta.throughput_target_rps ?? ''));
      setDisplayId(tc.display_id);
      setSteps(
        tc.test_steps.map((s) => ({
          id: s.id,
          step_number: s.step_number,
          description: s.description,
          test_data: s.test_data,
          expected_result: s.expected_result,
          is_automation_only: s.is_automation_only,
        })),
      );
      setVersions(tc.test_case_versions ?? []);
    } finally {
      setLoading(false);
    }
  }, [testCaseId]);

  useEffect(() => {
    if (open && testCaseId && !createMode) {
      fetchTestCase();
    } else if (open && createMode) {
      setTitle('');
      setDescription('');
      setPrecondition('');
      setType('functional');
      setAutomationStatus('not_automated');
      setAutomationFilePath('');
      setPlatformTags([]);
      setPriority('');
      setCategory('');
      setTags('');
      setResponseTimeThreshold('');
      setThroughputTarget('');
      setSteps([]);
      setDisplayId('');
      setVersions([]);
    }
  }, [open, testCaseId, createMode, fetchTestCase]);

  const handleSave = async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    setSaving(true);
    setError('');

    try {
      const tagArray = tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const metadata: Record<string, unknown> = {};
      if (type === 'performance') {
        if (responseTimeThreshold) metadata.response_time_threshold_ms = Number(responseTimeThreshold);
        if (throughputTarget) metadata.throughput_target_rps = Number(throughputTarget);
      }

      if (createMode) {
        const res = await fetch('/api/test-cases', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            suite_id: suiteId,
            title: title.trim(),
            description: description.trim() || null,
            precondition: precondition.trim() || null,
            type,
            automation_status: automationStatus,
            automation_file_path: automationFilePath.trim() || null,
            platform_tags: platformTags,
            priority: priority || null,
            category: category || null,
            tags: tagArray,
            metadata,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error || 'Failed to create');
          return;
        }

        const newTc = await res.json();

        if (steps.length > 0) {
          await fetch(`/api/test-cases/${newTc.id}/steps`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ steps }),
          });
        }
      } else if (testCaseId) {
        const [tcRes, stepsRes] = await Promise.all([
          fetch(`/api/test-cases/${testCaseId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: title.trim(),
              description: description.trim() || null,
              precondition: precondition.trim() || null,
              type,
              automation_status: automationStatus,
              automation_file_path: automationFilePath.trim() || null,
              platform_tags: platformTags,
              priority: priority || null,
              category: category || null,
              tags: tagArray,
              metadata,
            }),
          }),
          fetch(`/api/test-cases/${testCaseId}/steps`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ steps }),
          }),
        ]);

        if (!tcRes.ok) {
          const data = await tcRes.json();
          setError(data.error || 'Failed to save');
          return;
        }
        if (!stepsRes.ok) {
          setError('Failed to save steps');
          return;
        }
      }

      onSaved();
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  };

  const handlePlatformToggle = (platform: Platform) => {
    setPlatformTags((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform],
    );
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 600 },
          bgcolor: 'background.paper',
        },
      }}
    >
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Header */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 3,
              py: 2,
              borderBottom: `1px solid ${palette.divider}`,
            }}
          >
            {displayId && (
              <Chip
                label={displayId}
                size="small"
                variant="outlined"
                sx={{ fontFamily: 'monospace', fontWeight: 600 }}
              />
            )}
            <Typography variant="h6" sx={{ flex: 1, fontWeight: 600 }}>
              {createMode ? 'New Test Case' : title || 'Test Case'}
            </Typography>
            <IconButton onClick={onClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>

          {/* Body */}
          <Box sx={{ flex: 1, overflow: 'auto', px: 3, py: 2, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <TextField
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              fullWidth
              error={!!error && !title.trim()}
              helperText={error && !title.trim() ? error : ''}
              disabled={readOnly}
              slotProps={{ htmlInput: { maxLength: 500 } }}
            />

            <TextField
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
              multiline
              minRows={2}
              maxRows={6}
              disabled={readOnly}
            />

            <TextField
              label="Precondition"
              value={precondition}
              onChange={(e) => setPrecondition(e.target.value)}
              fullWidth
              multiline
              minRows={1}
              maxRows={4}
              disabled={readOnly}
            />

            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Type</InputLabel>
                <Select
                  value={type}
                  onChange={(e) => setType(e.target.value as TestCaseType)}
                  label="Type"
                  disabled={readOnly}
                >
                  {TYPE_OPTIONS.map((o) => (
                    <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth size="small">
                <InputLabel>Automation Status</InputLabel>
                <Select
                  value={automationStatus}
                  onChange={(e) => setAutomationStatus(e.target.value as AutomationStatus)}
                  label="Automation Status"
                  disabled={readOnly}
                >
                  {AUTOMATION_OPTIONS.map((o) => (
                    <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {type === 'performance' && (
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="Response Time Threshold (ms)"
                  value={responseTimeThreshold}
                  onChange={(e) => setResponseTimeThreshold(e.target.value)}
                  fullWidth
                  size="small"
                  type="number"
                  placeholder="e.g. 500"
                  disabled={readOnly}
                />
                <TextField
                  label="Throughput Target (req/s)"
                  value={throughputTarget}
                  onChange={(e) => setThroughputTarget(e.target.value)}
                  fullWidth
                  size="small"
                  type="number"
                  placeholder="e.g. 100"
                  disabled={readOnly}
                />
              </Box>
            )}

            {automationStatus !== 'not_automated' && (
              <TextField
                label="Automation File Path"
                value={automationFilePath}
                onChange={(e) => setAutomationFilePath(e.target.value)}
                fullWidth
                size="small"
                placeholder="e.g. tests/e2e/sponsor-registration.spec.ts"
                disabled={readOnly}
                slotProps={{ htmlInput: { maxLength: 500 } }}
              />
            )}

            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Priority</InputLabel>
                <Select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Priority | '')}
                  label="Priority"
                  disabled={readOnly}
                >
                  <MenuItem value="">None</MenuItem>
                  {PRIORITY_OPTIONS.map((o) => (
                    <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                  Platforms
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  {PLATFORM_OPTIONS.map((p) => {
                    const isSelected = platformTags.includes(p.value);
                    return (
                      <Chip
                        key={p.value}
                        label={p.label}
                        size="small"
                        variant={isSelected ? 'filled' : 'outlined'}
                        onClick={readOnly ? undefined : () => handlePlatformToggle(p.value)}
                        sx={{
                          cursor: readOnly ? 'default' : 'pointer',
                          ...(isSelected && {
                            bgcolor: alpha(palette.primary.main, 0.15),
                            color: palette.primary.main,
                          }),
                        }}
                      />
                    );
                  })}
                </Box>
              </Box>
            </Box>

            <FormControl fullWidth size="small">
              <InputLabel>Category</InputLabel>
              <Select
                value={category}
                onChange={(e) => setCategory(e.target.value as TestCaseCategory | '')}
                label="Category"
                disabled={readOnly}
              >
                <MenuItem value="">None</MenuItem>
                {CATEGORY_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Tags (comma separated)"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              fullWidth
              size="small"
              disabled={readOnly}
            />

            <Divider />

            <StepEditor steps={steps} onChange={setSteps} readOnly={readOnly} projectId={projectId} />

            {/* Bug Links */}
            {!createMode && testCaseId && (
              <>
                <Divider />
                <BugLinksList testCaseId={testCaseId} readOnly={readOnly} />
              </>
            )}

            {/* Version History (shown for existing test cases) */}
            {!createMode && versions.length > 0 && (
              <>
                <Divider />
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                    Version History ({versions.length})
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    {versions.slice(0, 10).map((v) => (
                      <Box
                        key={v.id}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          py: 0.5,
                          px: 1,
                          borderRadius: '4px',
                          bgcolor: 'background.default',
                        }}
                      >
                        <Chip
                          label={`v${v.version_number}`}
                          size="small"
                          variant="outlined"
                          sx={{ height: 20, fontSize: '0.6rem', fontFamily: 'monospace' }}
                        />
                        <Typography variant="caption" sx={{ flex: 1, color: 'text.secondary' }}>
                          {v.change_summary || 'Updated'}
                        </Typography>
                        {v.changer?.full_name && (
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                            {v.changer.full_name}
                          </Typography>
                        )}
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {new Date(v.created_at).toLocaleDateString()}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              </>
            )}

            {error && (
              <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                {error}
              </Typography>
            )}
          </Box>

          {/* Footer */}
          {!readOnly && (
            <Box
              sx={{
                display: 'flex',
                gap: 1,
                justifyContent: 'flex-end',
                px: 3,
                py: 2,
                borderTop: `1px solid ${palette.divider}`,
              }}
            >
              <Button onClick={onClose} color="inherit" disabled={saving}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                variant="contained"
                disabled={saving || !title.trim()}
              >
                {saving ? 'Saving...' : createMode ? 'Create Test Case' : 'Save Changes'}
              </Button>
            </Box>
          )}
        </Box>
      )}
    </Drawer>
  );
}
