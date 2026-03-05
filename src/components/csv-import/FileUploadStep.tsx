'use client';

import { useState, useCallback, useRef } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import { alpha } from '@mui/material/styles';
import { palette } from '@/theme/palette';

interface FileUploadStepProps {
  onFileSelected: (file: File) => void;
  uploading?: boolean;
  uploadProgress?: number;
  error?: string | null;
}

export default function FileUploadStep({ onFileSelected, uploading, uploadProgress, error: externalError }: FileUploadStepProps) {
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    (file: File) => {
      setError(null);

      if (!file.name.toLowerCase().endsWith('.csv')) {
        setError('Please select a .csv file');
        return;
      }
      if (file.size > 50 * 1024 * 1024) {
        setError('File must be under 50MB');
        return;
      }

      setFileName(file.name);
      onFileSelected(file);
    },
    [onFileSelected],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const displayError = externalError || error;

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
        Upload CSV File
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
        Upload a CSV file exported from Google Sheets. The system will
        auto-detect columns and parse test cases with their steps.
      </Typography>

      <Box
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onClick={() => !uploading && inputRef.current?.click()}
        sx={{
          border: `2px dashed ${dragOver ? palette.primary.main : palette.neutral.dark}`,
          borderRadius: 2,
          p: 6,
          textAlign: 'center',
          cursor: uploading ? 'default' : 'pointer',
          transition: 'border-color 0.2s, background-color 0.2s',
          bgcolor: dragOver
            ? alpha(palette.primary.main, 0.08)
            : 'transparent',
          '&:hover': uploading ? {} : {
            borderColor: palette.primary.main,
            bgcolor: alpha(palette.primary.main, 0.04),
          },
          opacity: uploading ? 0.7 : 1,
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) processFile(file);
          }}
        />

        {uploading ? (
          <>
            <InsertDriveFileOutlinedIcon
              sx={{ fontSize: 48, color: palette.primary.main, mb: 1 }}
            />
            <Typography variant="body1" sx={{ fontWeight: 600, mb: 1 }}>
              Uploading {fileName}...
            </Typography>
            <Box sx={{ px: 8, mt: 2 }}>
              <LinearProgress
                variant={uploadProgress !== undefined ? 'determinate' : 'indeterminate'}
                value={uploadProgress}
                sx={{
                  height: 6,
                  borderRadius: 3,
                  bgcolor: alpha(palette.neutral.main, 0.15),
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 3,
                    bgcolor: palette.primary.main,
                  },
                }}
              />
            </Box>
          </>
        ) : fileName ? (
          <>
            <InsertDriveFileOutlinedIcon
              sx={{ fontSize: 48, color: palette.success.main, mb: 1 }}
            />
            <Typography variant="body1" sx={{ fontWeight: 600 }}>
              {fileName}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Click or drop another file to replace
            </Typography>
          </>
        ) : (
          <>
            <CloudUploadOutlinedIcon
              sx={{ fontSize: 48, color: palette.neutral.main, mb: 1 }}
            />
            <Typography variant="body1" sx={{ fontWeight: 500, mb: 0.5 }}>
              Drag and drop your CSV file here
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              or click to browse (.csv, max 50MB)
            </Typography>
          </>
        )}
      </Box>

      {displayError && (
        <Typography
          variant="body2"
          sx={{ color: palette.error.main, mt: 2, textAlign: 'center' }}
        >
          {displayError}
        </Typography>
      )}
    </Box>
  );
}
