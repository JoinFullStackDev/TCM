'use client';

import { useParams, useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import IconButton from '@mui/material/IconButton';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import NextLink from 'next/link';
import PageTransition from '@/components/animations/PageTransition';
import ImportWizard from '@/components/csv-import/ImportWizard';
import { useAuth } from '@/components/providers/AuthProvider';

export default function ImportPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const { can } = useAuth();

  if (!can('write')) {
    router.push(`/projects/${projectId}`);
    return null;
  }

  return (
    <PageTransition>
      <Box>
        <Breadcrumbs sx={{ mb: 2 }}>
          <Link
            component={NextLink}
            href="/"
            underline="hover"
            color="text.secondary"
            fontSize="0.875rem"
          >
            Projects
          </Link>
          <Link
            component={NextLink}
            href={`/projects/${projectId}`}
            underline="hover"
            color="text.secondary"
            fontSize="0.875rem"
          >
            Project
          </Link>
          <Typography fontSize="0.875rem" color="text.primary">
            Import CSV
          </Typography>
        </Breadcrumbs>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <IconButton
            onClick={() => router.push(`/projects/${projectId}`)}
            size="small"
            sx={{ color: 'text.secondary' }}
          >
            <ArrowBackIcon fontSize="small" />
          </IconButton>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Import CSV
          </Typography>
        </Box>

        <ImportWizard
          projectId={projectId}
          onComplete={() => router.push(`/projects/${projectId}`)}
        />
      </Box>
    </PageTransition>
  );
}
