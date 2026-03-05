'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import { alpha } from '@mui/material/styles';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import BlockIcon from '@mui/icons-material/Block';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import { semanticColors } from '@/theme/palette';
import type { ExecutionStatus } from '@/types/database';

const STATUS_OPTIONS: { value: ExecutionStatus; label: string; icon: React.ReactElement }[] = [
  { value: 'not_run', label: 'Not Run', icon: <RemoveCircleOutlineIcon fontSize="small" /> },
  { value: 'pass', label: 'Pass', icon: <CheckCircleOutlineIcon fontSize="small" /> },
  { value: 'fail', label: 'Fail', icon: <CancelOutlinedIcon fontSize="small" /> },
  { value: 'blocked', label: 'Blocked', icon: <BlockIcon fontSize="small" /> },
  { value: 'skip', label: 'Skip', icon: <SkipNextIcon fontSize="small" /> },
];

interface ExecutionStatusCellProps {
  status: ExecutionStatus;
  onChange: (status: ExecutionStatus) => void;
  readOnly?: boolean;
}

export default function ExecutionStatusCell({ status, onChange, readOnly }: ExecutionStatusCellProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const color = semanticColors.executionStatus[status];
  const option = STATUS_OPTIONS.find((o) => o.value === status)!;

  return (
    <>
      <Box
        onClick={(e) => { if (!readOnly) setAnchorEl(e.currentTarget); }}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0.5,
          px: 1,
          py: 0.5,
          borderRadius: '4px',
          bgcolor: alpha(color, 0.12),
          color,
          cursor: readOnly ? 'default' : 'pointer',
          transition: 'background-color 0.15s',
          fontSize: '0.7rem',
          fontWeight: 600,
          minWidth: 80,
          '&:hover': readOnly ? {} : {
            bgcolor: alpha(color, 0.25),
          },
        }}
      >
        {option.icon}
        {option.label}
      </Box>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        {STATUS_OPTIONS.map((opt) => {
          const optColor = semanticColors.executionStatus[opt.value];
          return (
            <MenuItem
              key={opt.value}
              selected={opt.value === status}
              onClick={() => {
                onChange(opt.value);
                setAnchorEl(null);
              }}
            >
              <ListItemIcon sx={{ color: optColor }}>{opt.icon}</ListItemIcon>
              <ListItemText primaryTypographyProps={{ fontSize: '0.8125rem', color: optColor }}>
                {opt.label}
              </ListItemText>
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}
