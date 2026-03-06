'use client';

import { useState, useCallback } from 'react';
import Popover from '@mui/material/Popover';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';
import { type GridRenderEditCellParams, useGridApiContext } from '@mui/x-data-grid-pro';
import { palette } from '@/theme/palette';

export default function TagsEditCell(params: GridRenderEditCellParams) {
  const apiRef = useGridApiContext();
  const [anchorEl, setAnchorEl] = useState<HTMLDivElement | null>(null);
  const anchorRef = useCallback((node: HTMLDivElement | null) => { setAnchorEl(node); }, []);
  const [tags, setTags] = useState<string[]>(
    (params.value as string[]) ?? [],
  );

  const handleChange = (_: unknown, newValue: string[]) => {
    setTags(newValue);
    apiRef.current.setEditCellValue({
      id: params.id,
      field: params.field,
      value: newValue,
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
              p: 1.5,
              width: 280,
              bgcolor: palette.background.surface2,
              border: `1px solid ${palette.divider}`,
            },
          },
        }}
      >
        <Autocomplete
          multiple
          freeSolo
          options={[]}
          value={tags}
          onChange={handleChange}
          autoFocus
          size="small"
          renderTags={(value, getTagProps) =>
            value.map((tag, index) => {
              const { key, ...rest } = getTagProps({ index });
              return (
                <Chip
                  key={key}
                  label={tag}
                  size="small"
                  variant="outlined"
                  sx={{ height: 22, fontSize: '0.65rem' }}
                  {...rest}
                />
              );
            })
          }
          renderInput={(inputParams) => (
            <TextField
              {...inputParams}
              placeholder={tags.length === 0 ? 'Add tags...' : ''}
              variant="outlined"
              size="small"
              autoFocus
            />
          )}
        />
      </Popover>
    </Box>
  );
}
