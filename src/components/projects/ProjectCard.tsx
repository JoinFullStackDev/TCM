'use client';

import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import { alpha } from '@mui/material/styles';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { palette } from '@/theme/palette';

interface ProjectCardProps {
  id: string;
  name: string;
  description: string | null;
  suiteCount: number;
  testCaseCount: number;
  isArchived: boolean;
  onMenuOpen: (event: React.MouseEvent<HTMLElement>, id: string) => void;
  showMenu?: boolean;
}

export default function ProjectCard({
  id,
  name,
  description,
  suiteCount,
  testCaseCount,
  isArchived,
  onMenuOpen,
  showMenu = true,
}: ProjectCardProps) {
  const router = useRouter();

  return (
    <Box
      onClick={() => router.push(`/projects/${id}`)}
      sx={{
        p: 2.5,
        border: `1px solid ${palette.divider}`,
        borderRadius: '8px',
        bgcolor: 'background.paper',
        cursor: 'pointer',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        position: 'relative',
        opacity: isArchived ? 0.6 : 1,
        '&:hover': {
          borderColor: alpha(palette.primary.main, 0.5),
          boxShadow: `0 0 0 1px ${alpha(palette.primary.main, 0.2)}`,
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1.5 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: '8px',
            bgcolor: alpha(palette.primary.main, 0.12),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <FolderOutlinedIcon sx={{ fontSize: 20, color: palette.primary.main }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 600,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {name}
          </Typography>
          {description && (
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {description}
            </Typography>
          )}
        </Box>
        {showMenu && (
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onMenuOpen(e, id);
            }}
            sx={{ color: 'text.secondary', mt: -0.5 }}
          >
            <MoreVertIcon fontSize="small" />
          </IconButton>
        )}
      </Box>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Chip
          label={`${suiteCount} suite${suiteCount !== 1 ? 's' : ''}`}
          size="small"
          sx={{
            height: 22,
            fontSize: '0.7rem',
            bgcolor: alpha(palette.info.main, 0.1),
            color: palette.info.main,
          }}
        />
        <Chip
          label={`${testCaseCount} case${testCaseCount !== 1 ? 's' : ''}`}
          size="small"
          sx={{
            height: 22,
            fontSize: '0.7rem',
            bgcolor: alpha(palette.neutral.main, 0.1),
            color: palette.neutral.light,
          }}
        />
        {isArchived && (
          <Chip
            label="Archived"
            size="small"
            sx={{
              height: 22,
              fontSize: '0.7rem',
              bgcolor: alpha(palette.warning.main, 0.1),
              color: palette.warning.main,
            }}
          />
        )}
      </Box>
    </Box>
  );
}
