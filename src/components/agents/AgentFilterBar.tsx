'use client';

import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import type { AgentRunFilters } from '@/types/agent-run';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'done', label: 'Done' },
  { value: 'failed', label: 'Failed' },
  { value: 'killed', label: 'Killed' },
];

const AGENT_OPTIONS = [
  { value: '', label: 'All agents' },
  { value: 'axel', label: 'Axel' },
  { value: 'riff', label: 'Riff' },
  { value: 'arc', label: 'ARC' },
  { value: 'torque', label: 'Torque' },
  { value: 'clutch', label: 'Clutch' },
  { value: 'scout', label: 'Scout' },
];

const RUN_TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'subagent', label: 'Subagent' },
  { value: 'orchestrator', label: 'Orchestrator' },
];

interface Props {
  filters: AgentRunFilters;
  onChange: (filters: AgentRunFilters) => void;
}

export default function AgentFilterBar({ filters, onChange }: Props) {
  return (
    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
      <FormControl size="small" sx={{ minWidth: 160 }}>
        <InputLabel>Agent</InputLabel>
        <Select
          value={filters.agent ?? ''}
          label="Agent"
          onChange={(e) => onChange({ ...filters, agent: e.target.value || undefined })}
        >
          {AGENT_OPTIONS.map((o) => (
            <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl size="small" sx={{ minWidth: 160 }}>
        <InputLabel>Status</InputLabel>
        <Select
          value={filters.status ?? ''}
          label="Status"
          onChange={(e) => onChange({ ...filters, status: e.target.value || undefined })}
        >
          {STATUS_OPTIONS.map((o) => (
            <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
          ))}
        </Select>
      </FormControl>

      <TextField
        size="small"
        label="Project"
        value={filters.projectTag ?? ''}
        onChange={(e) => onChange({ ...filters, projectTag: e.target.value || undefined })}
        sx={{ minWidth: 150 }}
        placeholder="e.g. fullthrottle"
      />

      <FormControl size="small" sx={{ minWidth: 160 }}>
        <InputLabel>Run type</InputLabel>
        <Select
          value={filters.runType ?? ''}
          label="Run type"
          onChange={(e) => onChange({ ...filters, runType: (e.target.value || undefined) as typeof filters.runType })}
        >
          {RUN_TYPE_OPTIONS.map((o) => (
            <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControlLabel
        control={
          <Switch
            size="small"
            checked={!!filters.includeArchived}
            onChange={(e) => onChange({ ...filters, includeArchived: e.target.checked })}
          />
        }
        label="Include archived"
        sx={{ ml: 0 }}
      />
    </Box>
  );
}
