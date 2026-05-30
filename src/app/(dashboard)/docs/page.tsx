'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import DocsPage from '@/components/docs/DocsPage';
import { useDocs } from '@/hooks/useDocs';

function DocsPageInner() {
  const searchParams = useSearchParams();
  const docId = searchParams.get('docId');

  const hook = useDocs(docId);

  return (
    <Box sx={{ height: '100%', overflow: 'hidden' }}>
      <DocsPage hook={hook} />
    </Box>
  );
}

export default function DocsRoute() {
  return (
    <Suspense
      fallback={
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <CircularProgress size={32} />
        </Box>
      }
    >
      <DocsPageInner />
    </Suspense>
  );
}
