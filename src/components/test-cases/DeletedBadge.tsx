'use client';

import Chip from '@mui/material/Chip';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import Tooltip from '@mui/material/Tooltip';

interface DeletedBadgeProps {
  deletedAt?: string | null;
  /** Show tooltip with deletion timestamp when true (default: true). */
  showTooltip?: boolean;
  size?: 'small' | 'medium';
}

/**
 * Badge displayed in historical run results when a test case has been soft-deleted.
 * Shown next to the test case title so testers can identify removed cases.
 */
export default function DeletedBadge({ deletedAt, showTooltip = true, size = 'small' }: DeletedBadgeProps) {
  const chip = (
    <Chip
      label="Deleted"
      icon={<DeleteOutlineIcon />}
      size={size}
      color="warning"
      variant="outlined"
      sx={{ fontWeight: 600, fontSize: '0.65rem', height: 20, '& .MuiChip-label': { px: 0.75 } }}
    />
  );

  if (!showTooltip || !deletedAt) return chip;

  const formatted = new Date(deletedAt).toLocaleString();
  return (
    <Tooltip title={`Moved to trash on ${formatted}`}>
      {chip}
    </Tooltip>
  );
}
