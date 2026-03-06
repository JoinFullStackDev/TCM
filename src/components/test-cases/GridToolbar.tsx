'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import {
  GridToolbarContainer,
  GridToolbarColumnsButton,
  useGridApiContext,
} from '@mui/x-data-grid-pro';
import { palette } from '@/theme/palette';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface TestRunOption {
  id: string;
  name: string;
}

declare module '@mui/x-data-grid-pro' {
  interface ToolbarPropsOverrides {
    saveStatus?: SaveStatus;
    runs?: TestRunOption[];
    selectedRunId?: string | null;
    onRunChange?: (runId: string | null) => void;
  }
}

export default function GridToolbar(props: {
  saveStatus?: SaveStatus;
  runs?: TestRunOption[];
  selectedRunId?: string | null;
  onRunChange?: (runId: string | null) => void;
}) {
  const { saveStatus = 'idle', runs, selectedRunId, onRunChange } = props;
  const apiRef = useGridApiContext();

  const handleExport = () => {
    apiRef.current.exportDataAsCsv({
      fileName: `test-cases-${new Date().toISOString().split('T')[0]}`,
      utf8WithBom: true,
    });
  };

  return (
    <GridToolbarContainer
      sx={{
        px: 2,
        py: 1,
        gap: 1,
        borderBottom: `1px solid ${palette.divider}`,
      }}
    >
      <GridToolbarColumnsButton />

      <Button
        size="small"
        variant="outlined"
        color="inherit"
        startIcon={<FileDownloadOutlinedIcon fontSize="small" />}
        onClick={handleExport}
        sx={{ fontSize: '0.75rem' }}
      >
        Export CSV
      </Button>

      <FormControl size="small" sx={{ minWidth: 200, ml: 1 }}>
        <InputLabel sx={{ fontSize: '0.75rem' }}>Test Run</InputLabel>
        <Select
          value={selectedRunId ?? ''}
          onChange={(e) => onRunChange?.(e.target.value || null)}
          label="Test Run"
          sx={{ fontSize: '0.75rem', height: 32 }}
          displayEmpty
        >
          <MenuItem value="">
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>No run selected</Typography>
          </MenuItem>
          {runs && runs.length > 0 ? (
            runs.map((r) => (
              <MenuItem key={r.id} value={r.id}>
                <Typography variant="caption">{r.name}</Typography>
              </MenuItem>
            ))
          ) : (
            <MenuItem disabled>
              <Typography variant="caption" sx={{ color: 'text.disabled' }}>No runs yet — create one from Test Runs page</Typography>
            </MenuItem>
          )}
        </Select>
      </FormControl>

      <Box sx={{ flex: 1 }} />

      {saveStatus !== 'idle' && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {saveStatus === 'saving' && (
            <>
              <CircularProgress size={14} sx={{ color: palette.primary.main }} />
              <Typography variant="caption" sx={{ color: palette.primary.main }}>
                Saving...
              </Typography>
            </>
          )}
          {saveStatus === 'saved' && (
            <>
              <CheckCircleOutlineIcon sx={{ fontSize: 14, color: palette.success.main }} />
              <Typography variant="caption" sx={{ color: palette.success.main }}>
                Saved
              </Typography>
            </>
          )}
          {saveStatus === 'error' && (
            <>
              <ErrorOutlineIcon sx={{ fontSize: 14, color: palette.error.main }} />
              <Typography variant="caption" sx={{ color: palette.error.main }}>
                Save failed
              </Typography>
            </>
          )}
        </Box>
      )}
    </GridToolbarContainer>
  );
}
