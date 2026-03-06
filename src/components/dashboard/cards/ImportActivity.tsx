'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import { alpha } from '@mui/material/styles';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import DashboardCard from '../DashboardCard';
import { palette } from '@/theme/palette';
import type { DashboardImportActivity } from '@/types/database';

const STATUS_COLORS: Record<string, string> = {
  pending: palette.neutral.main,
  processing: palette.primary.main,
  completed: palette.success.main,
  failed: palette.error.main,
};

export default function ImportActivity({
  data,
  index,
}: {
  data: unknown;
  index: number;
}) {
  const imports = (data as DashboardImportActivity[] | null) ?? [];

  return (
    <DashboardCard
      title="Import Activity"
      icon={<UploadFileOutlinedIcon fontSize="small" />}
      loading={data === null}
      isEmpty={imports.length === 0}
      emptyMessage="No imports yet"
      index={index}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {imports.map((imp) => {
          const statusColor = STATUS_COLORS[imp.status] ?? palette.neutral.main;
          return (
            <Box
              key={imp.id}
              sx={{
                py: 0.75,
                px: 1,
                borderRadius: 1,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 600,
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {imp.file_name}
                </Typography>
                <Chip
                  label={imp.status}
                  size="small"
                  sx={{
                    height: 18,
                    fontSize: '0.55rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    bgcolor: alpha(statusColor, 0.15),
                    color: statusColor,
                    '& .MuiChip-label': { px: 0.5 },
                  }}
                />
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.6rem' }}>
                  {imp.project_name}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.6rem' }}>
                  {imp.imported_count} imported
                  {imp.error_count > 0 && ` · ${imp.error_count} errors`}
                  {imp.skipped_count > 0 && ` · ${imp.skipped_count} skipped`}
                </Typography>
              </Box>
            </Box>
          );
        })}
      </Box>
    </DashboardCard>
  );
}
