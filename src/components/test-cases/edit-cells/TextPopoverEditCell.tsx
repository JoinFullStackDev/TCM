'use client';

import { useRef, useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import Popover from '@mui/material/Popover';
import TextField from '@mui/material/TextField';
import { type GridRenderEditCellParams, useGridApiContext } from '@mui/x-data-grid-pro';
import { palette } from '@/theme/palette';

export default function TextPopoverEditCell(params: GridRenderEditCellParams) {
  const apiRef = useGridApiContext();
  const cellRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState<string>((params.value as string) ?? '');

  const commit = useCallback(() => {
    apiRef.current.setEditCellValue({
      id: params.id,
      field: params.field,
      value: text || null,
    });
    apiRef.current.stopCellEditMode({ id: params.id, field: params.field });
  }, [apiRef, params.id, params.field, text]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      commit();
    }
    if (e.key === 'Escape') {
      apiRef.current.stopCellEditMode({
        id: params.id,
        field: params.field,
        ignoreModifications: true,
      });
    }
  };

  return (
    <Box ref={cellRef} sx={{ width: '100%', height: '100%' }}>
      <Popover
        open
        anchorEl={cellRef.current}
        onClose={commit}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: {
              p: 1.5,
              width: 360,
              bgcolor: palette.background.surface2,
              border: `1px solid ${palette.divider}`,
            },
          },
        }}
      >
        <TextField
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          multiline
          minRows={3}
          maxRows={8}
          fullWidth
          autoFocus
          size="small"
          placeholder={`Enter ${params.field}...`}
        />
      </Popover>
    </Box>
  );
}
