'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import { alpha } from '@mui/material/styles';
import { palette } from '@/theme/palette';
import type { AutomationStatus, TestCaseType, Priority, Platform, TestCaseCategory } from '@/types/database';

export interface BulkEditUpdates {
  automation_status?: AutomationStatus;
  type?: TestCaseType;
  priority?: Priority | null;
  platform_tags?: Platform[];
  category?: TestCaseCategory | null;
}

interface SuiteOption {
  id: string;
  name: string;
  prefix: string;
}

interface BulkEditToolbarProps {
  selectedCount: number;
  visible: boolean;
  onApply: (updates: BulkEditUpdates) => Promise<void>;
  onCancel: () => void;
  suites?: SuiteOption[];
  onMoveSuite?: (suiteId: string) => Promise<void>;
}

export default function BulkEditToolbar({
  selectedCount,
  visible,
  onApply,
  onCancel,
  suites,
  onMoveSuite,
}: BulkEditToolbarProps) {
  const [automationStatus, setAutomationStatus] = useState<string>('');
  const [type, setType] = useState<string>('');
  const [priority, setPriority] = useState<string>('');
  const [platformTags, setPlatformTags] = useState<Platform[]>([]);
  const [category, setCategory] = useState<string>('');
  const [moveSuiteId, setMoveSuiteId] = useState('');
  const [applying, setApplying] = useState(false);

  const hasChanges = automationStatus || type || priority || platformTags.length > 0 || category || moveSuiteId;

  const handleApply = async () => {
    setApplying(true);
    const updates: BulkEditUpdates = {};
    if (automationStatus) updates.automation_status = automationStatus as AutomationStatus;
    if (type) updates.type = type as TestCaseType;
    if (priority === '__none__') updates.priority = null;
    else if (priority) updates.priority = priority as Priority;
    if (platformTags.length > 0) updates.platform_tags = platformTags;
    if (category === '__none__') updates.category = null;
    else if (category) updates.category = category as TestCaseCategory;

    if (moveSuiteId && onMoveSuite) {
      await onMoveSuite(moveSuiteId);
    }
    if (Object.keys(updates).length > 0) {
      await onApply(updates);
    }
    setAutomationStatus('');
    setType('');
    setPriority('');
    setPlatformTags([]);
    setCategory('');
    setMoveSuiteId('');
    setApplying(false);
  };

  const handleCancel = () => {
    setAutomationStatus('');
    setType('');
    setPriority('');
    setPlatformTags([]);
    setCategory('');
    setMoveSuiteId('');
    onCancel();
  };

  return (
    <Collapse in={visible}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          px: 2,
          py: 1.5,
          borderBottom: `1px solid ${palette.divider}`,
          borderTop: `2px solid ${palette.primary.main}`,
          bgcolor: 'background.paper',
          flexWrap: 'wrap',
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: 600, mr: 1 }}>
          {selectedCount} selected
        </Typography>

        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Automation</InputLabel>
          <Select
            value={automationStatus}
            onChange={(e) => setAutomationStatus(e.target.value)}
            label="Automation"
          >
            <MenuItem value="">—</MenuItem>
            <MenuItem value="not_automated">Not Automated</MenuItem>
            <MenuItem value="scripted">Scripted</MenuItem>
            <MenuItem value="in_cicd">In CICD</MenuItem>
            <MenuItem value="out_of_sync">Out of Sync</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Type</InputLabel>
          <Select
            value={type}
            onChange={(e) => setType(e.target.value)}
            label="Type"
          >
            <MenuItem value="">—</MenuItem>
            <MenuItem value="functional">Functional</MenuItem>
            <MenuItem value="performance">Performance</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Priority</InputLabel>
          <Select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            label="Priority"
          >
            <MenuItem value="">—</MenuItem>
            <MenuItem value="critical">Critical</MenuItem>
            <MenuItem value="high">High</MenuItem>
            <MenuItem value="medium">Medium</MenuItem>
            <MenuItem value="low">Low</MenuItem>
            <MenuItem value="__none__">None</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>Category</InputLabel>
          <Select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            label="Category"
          >
            <MenuItem value="">—</MenuItem>
            <MenuItem value="smoke">Smoke</MenuItem>
            <MenuItem value="regression">Regression</MenuItem>
            <MenuItem value="integration">Integration</MenuItem>
            <MenuItem value="e2e">E2E</MenuItem>
            <MenuItem value="unit">Unit</MenuItem>
            <MenuItem value="acceptance">Acceptance</MenuItem>
            <MenuItem value="exploratory">Exploratory</MenuItem>
            <MenuItem value="performance">Performance</MenuItem>
            <MenuItem value="security">Security</MenuItem>
            <MenuItem value="usability">Usability</MenuItem>
            <MenuItem value="__none__">None</MenuItem>
          </Select>
        </FormControl>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', mr: 0.5 }}>Platforms:</Typography>
          {(['desktop', 'tablet', 'mobile'] as Platform[]).map((p) => {
            const selected = platformTags.includes(p);
            return (
              <Chip
                key={p}
                label={p.charAt(0).toUpperCase() + p.slice(1)}
                size="small"
                variant={selected ? 'filled' : 'outlined'}
                onClick={() => setPlatformTags((prev) =>
                  prev.includes(p) ? prev.filter((t) => t !== p) : [...prev, p]
                )}
                sx={selected ? {
                  bgcolor: alpha(palette.primary.main, 0.15),
                  color: palette.primary.main,
                } : undefined}
              />
            );
          })}
        </Box>

        {suites && suites.length > 0 && (
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Move to Suite</InputLabel>
            <Select
              value={moveSuiteId}
              onChange={(e) => setMoveSuiteId(e.target.value)}
              label="Move to Suite"
            >
              <MenuItem value="">—</MenuItem>
              {suites.map((s) => (
                <MenuItem key={s.id} value={s.id}>{s.prefix} — {s.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        <Box sx={{ flex: 1 }} />

        <Button onClick={handleCancel} color="inherit" size="small" disabled={applying}>
          Cancel
        </Button>
        <Button
          onClick={handleApply}
          variant="contained"
          size="small"
          disabled={!hasChanges || applying}
        >
          {applying ? 'Applying...' : 'Apply'}
        </Button>
      </Box>
    </Collapse>
  );
}
