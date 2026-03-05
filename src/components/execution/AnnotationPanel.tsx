'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import AddCommentIcon from '@mui/icons-material/AddComment';
import { alpha } from '@mui/material/styles';
import { palette } from '@/theme/palette';
import type { Annotation, Attachment } from '@/types/database';

interface AnnotationWithAttachments extends Annotation {
  attachments?: Attachment[];
}

interface AnnotationPanelProps {
  executionResultId: string;
  projectId: string;
  testRunId: string;
  readOnly?: boolean;
}

export default function AnnotationPanel({
  executionResultId, projectId, testRunId, readOnly,
}: AnnotationPanelProps) {
  const [annotations, setAnnotations] = useState<AnnotationWithAttachments[]>([]);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  const fetchAnnotationDetails = useCallback(async () => {
    const res = await fetch(`/api/annotations?execution_result_id=${executionResultId}`);
    if (!res.ok) {
      setAnnotations([]);
      return;
    }
    const data = await res.json();
    setAnnotations(Array.isArray(data) ? data : []);
  }, [executionResultId]);

  useEffect(() => {
    fetchAnnotationDetails();
  }, [fetchAnnotationDetails]);

  const handleAddComment = async () => {
    if (!comment.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/annotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          execution_result_id: executionResultId,
          comment: comment.trim(),
        }),
      });
      if (res.ok) {
        setComment('');
        fetchAnnotationDetails();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (annotationId: string, file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('project_id', projectId);
      formData.append('test_run_id', testRunId);
      formData.append('annotation_id', annotationId);

      await fetch('/api/upload', { method: 'POST', body: formData });
      fetchAnnotationDetails();
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (annotationId: string) => {
    await fetch(`/api/annotations/${annotationId}`, { method: 'DELETE' });
    fetchAnnotationDetails();
  };

  return (
    <Box sx={{ mt: 1, p: 2, borderRadius: '6px', bgcolor: alpha(palette.error.main, 0.04), border: `1px solid ${alpha(palette.error.main, 0.15)}` }}>
      <Typography variant="caption" sx={{ fontWeight: 600, color: palette.error.main, display: 'block', mb: 1 }}>
        Failure Annotations
      </Typography>

      {annotations.map((ann) => (
        <Box key={ann.id} sx={{ mb: 1.5, p: 1.5, borderRadius: '4px', bgcolor: 'background.paper' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Typography variant="body2">{ann.comment}</Typography>
            {!readOnly && (
              <IconButton size="small" onClick={() => handleDelete(ann.id)} sx={{ color: 'text.secondary', ml: 1 }}>
                <DeleteOutlineIcon sx={{ fontSize: 16 }} />
              </IconButton>
            )}
          </Box>

          {ann.attachments && ann.attachments.length > 0 && (
            <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
              {ann.attachments.map((att) => (
                <Box
                  key={att.id}
                  sx={{
                    width: 80,
                    height: 60,
                    borderRadius: '4px',
                    bgcolor: alpha(palette.neutral.main, 0.1),
                    border: `1px solid ${palette.divider}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  <Typography variant="caption" sx={{ fontSize: '0.5rem', color: 'text.secondary', textAlign: 'center', px: 0.5 }}>
                    {att.file_name}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}

          {!readOnly && (
            <Button
              size="small"
              startIcon={uploading ? <CircularProgress size={12} /> : <CloudUploadIcon />}
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/png,image/jpeg,image/webp,image/gif';
                input.onchange = (e) => {
                  const f = (e.target as HTMLInputElement).files?.[0];
                  if (f) handleUpload(ann.id, f);
                };
                input.click();
              }}
              disabled={uploading}
              sx={{ mt: 0.5, fontSize: '0.7rem' }}
            >
              Upload Screenshot
            </Button>
          )}
        </Box>
      ))}

      {!readOnly && (
        <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
          <TextField
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add a comment..."
            size="small"
            fullWidth
            multiline
            maxRows={3}
            disabled={saving}
          />
          <Button
            onClick={handleAddComment}
            variant="contained"
            size="small"
            disabled={saving || !comment.trim()}
            sx={{ minWidth: 'auto', px: 1.5 }}
          >
            <AddCommentIcon fontSize="small" />
          </Button>
        </Box>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" hidden />
    </Box>
  );
}
