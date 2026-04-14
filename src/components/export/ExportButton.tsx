'use client';

import { useState } from 'react';
import Button from '@mui/material/Button';
import DownloadIcon from '@mui/icons-material/DownloadOutlined';
import { useAuth } from '@/components/providers/AuthProvider';
import ExportModal from './ExportModal';

interface ExportButtonProps {
  projectId: string;
  projectName: string;
  suiteId?: string;
  suiteName?: string;
}

export default function ExportButton({
  projectId,
  projectName,
  suiteId,
  suiteName,
}: ExportButtonProps) {
  const { can } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);

  // Viewers cannot export
  if (!can('export')) return null;

  return (
    <>
      <Button
        variant="outlined"
        size="small"
        startIcon={<DownloadIcon />}
        onClick={() => setModalOpen(true)}
        sx={{ textTransform: 'none', fontWeight: 500 }}
      >
        Export
      </Button>

      <ExportModal
        open={modalOpen}
        projectId={projectId}
        projectName={projectName}
        suiteId={suiteId}
        suiteName={suiteName}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
