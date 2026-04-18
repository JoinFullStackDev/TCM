import Chip from '@mui/material/Chip';
import type { FeedbackStatus } from '@/types/database';

interface Props {
  status: FeedbackStatus;
  size?: 'small' | 'medium';
}

const STATUS_CONFIG: Record<FeedbackStatus, { label: string; color: 'default' | 'info' | 'success' | 'error' | 'warning' | 'primary' | 'secondary' }> = {
  new: { label: 'New', color: 'info' },
  under_review: { label: 'Under Review', color: 'warning' },
  accepted: { label: 'Accepted', color: 'success' },
  rejected: { label: 'Rejected', color: 'error' },
  exported: { label: 'Exported', color: 'secondary' },
};

export default function FeedbackStatusBadge({ status, size = 'small' }: Props) {
  const config = STATUS_CONFIG[status] ?? { label: status, color: 'default' as const };
  return (
    <Chip
      label={config.label}
      color={config.color}
      size={size}
      variant="outlined"
      sx={{ fontWeight: 600, fontSize: size === 'small' ? '0.7rem' : '0.8rem' }}
    />
  );
}
