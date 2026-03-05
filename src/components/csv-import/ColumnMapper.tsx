'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { alpha } from '@mui/material/styles';
import { palette } from '@/theme/palette';
import {
  type MappingEntry,
  type SystemField,
  SYSTEM_FIELD_LABELS,
} from '@/lib/csv/column-mapper';

const ALL_FIELDS: SystemField[] = [
  'display_id',
  'description',
  'precondition',
  'step_number',
  'step_description',
  'test_data',
  'expected_result',
  'platform_results',
  'automation_status_cell',
  'comments',
  'bug_link',
  'overall_status',
  'execution_date',
  'unmapped',
];

interface ColumnMapperProps {
  mappings: MappingEntry[];
  onMappingChange: (index: number, field: SystemField) => void;
}

export default function ColumnMapper({
  mappings,
  onMappingChange,
}: ColumnMapperProps) {
  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
        Column Mapping
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
        Map each CSV column to a system field. Auto-detected mappings are shown
        with a green indicator.
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {mappings.map((mapping, idx) => {
          if (!mapping.csvHeader) return null;
          const isHigh = mapping.confidence === 'high';
          const isMedium = mapping.confidence === 'medium';
          const isUnmapped = mapping.systemField === 'unmapped';

          const borderColor = isHigh
            ? palette.success.main
            : isMedium
              ? palette.warning.main
              : palette.neutral.main;

          return (
            <Box
              key={idx}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                px: 2,
                py: 1.5,
                borderRadius: 1,
                borderLeft: `4px solid ${borderColor}`,
                bgcolor: alpha(borderColor, 0.05),
              }}
            >
              <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                {isHigh && (
                  <CheckCircleOutlineIcon
                    sx={{ fontSize: 18, color: palette.success.main }}
                  />
                )}
                {isMedium && (
                  <WarningAmberIcon
                    sx={{ fontSize: 18, color: palette.warning.main }}
                  />
                )}
                {isUnmapped && (
                  <HelpOutlineIcon
                    sx={{ fontSize: 18, color: palette.neutral.main }}
                  />
                )}
                <Typography
                  variant="body2"
                  sx={{ fontWeight: 500, fontFamily: 'monospace' }}
                >
                  {mapping.csvHeader}
                </Typography>
              </Box>

              <Select
                value={mapping.systemField}
                onChange={(e) =>
                  onMappingChange(idx, e.target.value as SystemField)
                }
                size="small"
                sx={{ minWidth: 200, fontSize: '0.8rem' }}
              >
                {ALL_FIELDS.map((field) => (
                  <MenuItem key={field} value={field}>
                    {SYSTEM_FIELD_LABELS[field]}
                  </MenuItem>
                ))}
              </Select>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
