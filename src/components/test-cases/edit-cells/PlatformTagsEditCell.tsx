'use client';

import { useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Popover from '@mui/material/Popover';
import { alpha } from '@mui/material/styles';
import { type GridRenderEditCellParams, useGridApiContext } from '@mui/x-data-grid-pro';
import { palette } from '@/theme/palette';
import type { Platform } from '@/types/database';

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'desktop', label: 'Desktop' },
  { value: 'tablet', label: 'Tablet' },
  { value: 'mobile', label: 'Mobile' },
];

export default function PlatformTagsEditCell(params: GridRenderEditCellParams) {
  const apiRef = useGridApiContext();
  const [anchorEl, setAnchorEl] = useState<HTMLDivElement | null>(null);
  const anchorRef = useCallback((node: HTMLDivElement | null) => { setAnchorEl(node); }, []);
  const [selected, setSelected] = useState<Platform[]>(
    (params.value as Platform[]) ?? [],
  );

  const handleToggle = (platform: Platform) => {
    const next = selected.includes(platform)
      ? selected.filter((p) => p !== platform)
      : [...selected, platform];
    setSelected(next);
    apiRef.current.setEditCellValue({
      id: params.id,
      field: params.field,
      value: next,
    });
  };

  const handleClose = () => {
    apiRef.current.stopCellEditMode({ id: params.id, field: params.field });
  };

  return (
    <Box ref={anchorRef} sx={{ width: '100%', height: '100%' }}>
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: {
              p: 1,
              display: 'flex',
              gap: 0.5,
              bgcolor: palette.background.surface2,
              border: `1px solid ${palette.divider}`,
            },
          },
        }}
      >
        {PLATFORMS.map((p) => {
          const active = selected.includes(p.value);
          return (
            <Chip
              key={p.value}
              label={p.label}
              size="small"
              variant={active ? 'filled' : 'outlined'}
              onClick={() => handleToggle(p.value)}
              sx={{
                cursor: 'pointer',
                ...(active && {
                  bgcolor: alpha(palette.primary.main, 0.15),
                  color: palette.primary.main,
                }),
              }}
            />
          );
        })}
      </Popover>
    </Box>
  );
}
