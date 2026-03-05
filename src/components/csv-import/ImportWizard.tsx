'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import Box from '@mui/material/Box';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Button from '@mui/material/Button';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import { alpha } from '@mui/material/styles';
import { AnimatePresence, motion } from 'framer-motion';
import { palette } from '@/theme/palette';
import type { MappingEntry, SystemField } from '@/lib/csv/column-mapper';
import type { ParsedTestCase } from '@/lib/validations/csv-import';
import FileUploadStep from './FileUploadStep';
import ColumnMapper from './ColumnMapper';
import ReviewStep from './ReviewStep';
import ImportProgressStep from './ImportProgressStep';
import ImportCompleteStep from './ImportCompleteStep';

const STEPS = ['Upload', 'Map Columns', 'Review', 'Import', 'Done'];

interface ImportWizardProps {
  projectId: string;
  onComplete: () => void;
}

export default function ImportWizard({ projectId, onComplete }: ImportWizardProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [mappings, setMappings] = useState<MappingEntry[]>([]);
  const [importId, setImportId] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [totalRows, setTotalRows] = useState(0);

  const [parsedPreview, setParsedPreview] = useState<ParsedTestCase[]>([]);
  const [totalTestCases, setTotalTestCases] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const [duplicateIds, setDuplicateIds] = useState<string[]>([]);
  const [duplicateStrategy, setDuplicateStrategy] = useState<'skip' | 'update'>('skip');
  const [parsing, setParsing] = useState(false);

  const [importStatus, setImportStatus] = useState<'pending' | 'processing' | 'completed' | 'failed'>('pending');
  const [importedCount, setImportedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [importErrors, setImportErrors] = useState<Array<{ row_number: number | null; error_message: string }>>([]);
  const [toast, setToast] = useState<{ open: boolean; severity: 'success' | 'warning' | 'error'; message: string }>({ open: false, severity: 'success', message: '' });

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleFileSelected = useCallback(async (file: File) => {
    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('project_id', projectId);

      const res = await fetch('/api/csv-import/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setUploadError(err.error || err.details || 'Upload failed');
        setUploading(false);
        return;
      }

      const data = await res.json();
      setImportId(data.import_id);
      setFileName(data.file_name);
      setMappings(data.mappings);
      setTotalRows(data.total_rows);
      setActiveStep(1);
    } catch {
      setUploadError('Network error during upload');
    } finally {
      setUploading(false);
    }
  }, [projectId]);

  const handleMappingChange = useCallback(
    (index: number, field: SystemField) => {
      setMappings((prev) =>
        prev.map((m, i) =>
          i === index ? { ...m, systemField: field, confidence: 'high' as const } : m,
        ),
      );
    },
    [],
  );

  const handleConfirmMapping = useCallback(async () => {
    if (!importId) return;
    setParsing(true);

    try {
      const res = await fetch('/api/csv-import/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          import_id: importId,
          confirmed_mappings: mappings,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setToast({ open: true, severity: 'error', message: err.error || 'Parsing failed' });
        setParsing(false);
        return;
      }

      const data = await res.json();
      setParsedPreview(data.preview);
      setTotalTestCases(data.total_test_cases);
      setTotalSteps(data.total_steps);
      setDuplicateIds(data.duplicate_ids);
      setActiveStep(2);
    } catch {
      setToast({ open: true, severity: 'error', message: 'Network error during parsing' });
    } finally {
      setParsing(false);
    }
  }, [importId, mappings]);

  const handleStartImport = useCallback(async () => {
    if (!importId) return;
    setActiveStep(3);
    setImportStatus('processing');
    setImportedCount(0);
    setSkippedCount(0);
    setErrorCount(0);
    setImportErrors([]);

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/csv-import/${importId}`);
        if (res.ok) {
          const progress = await res.json();
          setImportedCount(progress.imported_count ?? 0);
          setSkippedCount(progress.skipped_count ?? 0);
          setErrorCount(progress.error_count ?? 0);
        }
      } catch {
        // polling errors are non-fatal
      }
    }, 2000);

    try {
      const res = await fetch('/api/csv-import/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          import_id: importId,
          duplicate_strategy: duplicateStrategy,
        }),
      });

      if (pollRef.current) clearInterval(pollRef.current);

      if (res.ok) {
        const result = await res.json();
        setImportedCount(result.imported_count ?? 0);
        setSkippedCount(result.skipped_count ?? 0);
        setErrorCount(result.error_count ?? 0);
        setImportErrors(result.errors ?? []);
        setImportStatus('completed');
        setActiveStep(4);
        if (result.error_count > 0 && result.imported_count > 0) {
          setToast({ open: true, severity: 'warning', message: `${result.imported_count} test cases imported with ${result.error_count} errors` });
        } else if (result.error_count === 0) {
          setToast({ open: true, severity: 'success', message: `${result.imported_count} test cases imported successfully` });
        }
      } else {
        const err = await res.json().catch(() => ({}));
        setImportStatus('failed');
        setImportErrors([{ row_number: null, error_message: err.error ?? 'Import failed' }]);
        setErrorCount(1);
        setToast({ open: true, severity: 'error', message: 'Import failed. Check error details.' });
      }
    } catch {
      if (pollRef.current) clearInterval(pollRef.current);
      setImportStatus('failed');
      setImportErrors([{ row_number: null, error_message: 'Network error during import' }]);
      setErrorCount(1);
    }
  }, [importId, duplicateStrategy]);

  const canProceed = useMemo(() => {
    if (activeStep === 0) return false;
    if (activeStep === 1) return mappings.some((m) => m.systemField !== 'unmapped') && !parsing;
    if (activeStep === 2) return totalTestCases > 0;
    return false;
  }, [activeStep, mappings, parsing, totalTestCases]);

  return (
    <Box>
      <Stepper
        activeStep={activeStep}
        sx={{
          mb: 4,
          '& .MuiStepIcon-root.Mui-completed': { color: palette.success.main },
          '& .MuiStepIcon-root.Mui-active': { color: palette.primary.main },
        }}
      >
        {STEPS.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <Box
        sx={{
          p: 3,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          bgcolor: 'background.paper',
          minHeight: 400,
          overflow: 'hidden',
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activeStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {activeStep === 0 && (
              <FileUploadStep
                onFileSelected={handleFileSelected}
                uploading={uploading}
                error={uploadError}
              />
            )}

            {activeStep === 1 && (
              <ColumnMapper
                mappings={mappings}
                onMappingChange={handleMappingChange}
              />
            )}

            {activeStep === 2 && (
              <ReviewStep
                parsedData={parsedPreview}
                duplicateIds={duplicateIds}
                duplicateStrategy={duplicateStrategy}
                onDuplicateStrategyChange={setDuplicateStrategy}
                totalTestCases={totalTestCases}
                totalSteps={totalSteps}
              />
            )}

            {activeStep === 3 && (
              <ImportProgressStep
                status={importStatus}
                importedCount={importedCount}
                skippedCount={skippedCount}
                errorCount={errorCount}
                totalCount={totalTestCases}
              />
            )}

            {activeStep === 4 && (
              <ImportCompleteStep
                importedCount={importedCount}
                skippedCount={skippedCount}
                errorCount={errorCount}
                projectId={projectId}
                onViewTestCases={onComplete}
                errors={importErrors}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </Box>

      <Snackbar
        open={toast.open}
        autoHideDuration={5000}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={toast.severity} onClose={() => setToast((t) => ({ ...t, open: false }))} variant="filled">
          {toast.message}
        </Alert>
      </Snackbar>

      {activeStep >= 1 && activeStep < 3 && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
          <Button
            disabled={activeStep <= 1}
            onClick={() => setActiveStep((s) => s - 1)}
            variant="outlined"
            color="inherit"
          >
            Back
          </Button>
          <Button
            disabled={!canProceed}
            variant="contained"
            onClick={() => {
              if (activeStep === 1) handleConfirmMapping();
              else if (activeStep === 2) handleStartImport();
            }}
          >
            {activeStep === 1 ? (parsing ? 'Parsing...' : 'Next') : 'Start Import'}
          </Button>
        </Box>
      )}
    </Box>
  );
}
