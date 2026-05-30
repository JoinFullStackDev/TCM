'use client';

import { useState, useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Chip from '@mui/material/Chip';
import LinkIcon from '@mui/icons-material/Link';
import CheckIcon from '@mui/icons-material/Check';
import NoteEditor from '@/components/notes/NoteEditor';
import type { Doc } from '@/types/database';
import type { UseDocsReturn } from '@/hooks/useDocs';
import { useAuth } from '@/components/providers/AuthProvider';

interface DocEditorProps {
  doc: Doc;
  saveStatus: UseDocsReturn['saveStatus'];
  onContentChange: UseDocsReturn['saveDocContent'];
  onTitleChange: UseDocsReturn['saveDocTitle'];
}

export default function DocEditor({ doc, saveStatus, onContentChange, onTitleChange }: DocEditorProps) {
  const { can } = useAuth();
  const canWrite = can('write');

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(doc.title);
  const [copied, setCopied] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Sync title when doc changes
  useEffect(() => {
    setTitleValue(doc.title);
  }, [doc.id, doc.title]);

  const handleTitleBlur = async () => {
    setEditingTitle(false);
    const trimmed = titleValue.trim();
    if (trimmed && trimmed !== doc.title) {
      await onTitleChange(trimmed);
    } else {
      setTitleValue(doc.title);
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') titleInputRef.current?.blur();
    if (e.key === 'Escape') {
      setTitleValue(doc.title);
      setEditingTitle(false);
    }
  };

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/docs?docId=${doc.id}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const saveLabel = saveStatus === 'saving'
    ? 'Saving…'
    : saveStatus === 'saved'
      ? 'Saved'
      : saveStatus === 'error'
        ? 'Save failed'
        : null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Editor header */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        px: 3,
        py: 1.5,
        borderBottom: '1px solid',
        borderColor: 'divider',
        gap: 1,
        flexShrink: 0,
      }}>
        {/* Title */}
        {editingTitle && canWrite ? (
          <TextField
            inputRef={titleInputRef}
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={handleTitleKeyDown}
            autoFocus
            size="small"
            variant="standard"
            sx={{ flex: 1 }}
            inputProps={{ style: { fontSize: '1rem', fontWeight: 600 } }}
          />
        ) : (
          <Typography
            variant="h6"
            sx={{
              flex: 1,
              fontSize: '1rem',
              fontWeight: 600,
              cursor: canWrite ? 'text' : 'default',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            onClick={() => canWrite && setEditingTitle(true)}
          >
            {doc.title}
          </Typography>
        )}

        {/* Metadata row */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
          {saveLabel && (
            <Typography variant="caption" color={saveStatus === 'error' ? 'error.main' : 'text.secondary'}>
              {saveLabel}
            </Typography>
          )}

          <Typography variant="caption" color="text.disabled">
            Updated {new Date(doc.updated_at).toLocaleDateString()}
          </Typography>

          {doc.project_id && (
            <Chip label="Project" size="small" sx={{ height: 20, fontSize: '0.65rem' }} />
          )}

          <Tooltip title={copied ? 'Copied!' : 'Copy link'}>
            <IconButton size="small" onClick={handleCopyLink}>
              {copied ? <CheckIcon sx={{ fontSize: 16, color: 'success.main' }} /> : <LinkIcon sx={{ fontSize: 16 }} />}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Editor body */}
      <Box sx={{ flex: 1, overflow: 'auto', px: 3, py: 2 }}>
        <NoteEditor
          key={doc.id}
          content={doc.content ?? ''}
          onChange={(content) => onContentChange(content)}
          readOnly={!canWrite}
          placeholder="Start writing your document…"
          minHeight={400}
        />
      </Box>
    </Box>
  );
}
