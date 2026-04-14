'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Box from '@mui/material/Box';
import Fab from '@mui/material/Fab';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import Collapse from '@mui/material/Collapse';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import EditNoteIcon from '@mui/icons-material/EditNote';
import CloseIcon from '@mui/icons-material/Close';
import PublicIcon from '@mui/icons-material/Public';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import LinkIcon from '@mui/icons-material/Link';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import InputAdornment from '@mui/material/InputAdornment';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import { alpha } from '@mui/material/styles';
import SearchIcon from '@mui/icons-material/Search';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import { motion, AnimatePresence } from 'framer-motion';
import NoteEditor from './NoteEditor';
import { palette } from '@/theme/palette';
import { useAuth } from '@/components/providers/AuthProvider';
import type { NoteAttachment, LinkedTestCase, TestCase } from '@/types/database';

export default function QuickNotesFab() {
  const { can } = useAuth();
  const [panelOpen, setPanelOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [contentPlain, setContentPlain] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'team'>('private');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [showMeetingUrl, setShowMeetingUrl] = useState(false);
  const [attachments, setAttachments] = useState<NoteAttachment[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Test case linking
  const [linkedTestCases, setLinkedTestCases] = useState<LinkedTestCase[]>([]);
  const [tcSearch, setTcSearch] = useState('');
  const [tcSearchResults, setTcSearchResults] = useState<TestCase[]>([]);
  const [tcSearchOpen, setTcSearchOpen] = useState(false);
  const [tcSearchLoading, setTcSearchLoading] = useState(false);

  const canWrite = can('write');

  // --- Drag-to-reposition (no library, raw pointer events) ---
  const FAB_SIZE = 56;
  const MARGIN = 24;

  // pos is in "right/bottom" terms to match CSS fixed positioning intuitively
  const [pos, setPos] = useState<{ right: number; bottom: number } | null>(null);
  const fabRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ startX: number; startY: number; startRight: number; startBottom: number } | null>(null);
  const didDrag = useRef(false);

  useEffect(() => {
    setPos({ right: MARGIN, bottom: MARGIN });
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Only drag on primary button, ignore clicks inside the panel
    if (e.button !== 0) return;
    didDrag.current = false;
    const fab = fabRef.current;
    if (!fab) return;
    fab.setPointerCapture(e.pointerId);
    const rect = fab.getBoundingClientRect();
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      startRight: window.innerWidth - rect.right,
      startBottom: window.innerHeight - rect.bottom,
    };
    e.stopPropagation();
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDrag.current = true;
    if (!didDrag.current) return;

    const newRight = Math.max(0, Math.min(
      window.innerWidth - FAB_SIZE,
      dragState.current.startRight - dx,
    ));
    const newBottom = Math.max(0, Math.min(
      window.innerHeight - FAB_SIZE,
      dragState.current.startBottom - dy,
    ));
    setPos({ right: newRight, bottom: newBottom });
  }, []);

  const handlePointerUp = useCallback(() => {
    dragState.current = null;
    // Reset after a short delay so the onClick handler can read the value first
    setTimeout(() => { didDrag.current = false; }, 0);
  }, []);

  const resetForm = useCallback(() => {
    setTitle('');
    setContent('');
    setContentPlain('');
    setVisibility('private');
    setMeetingUrl('');
    setShowMeetingUrl(false);
    setAttachments([]);
    setError(null);
    setSavedId(null);
    setLinkedTestCases([]);
    setTcSearch('');
    setTcSearchResults([]);
  }, []);

  const handleSave = useCallback(async () => {
    if (!content.trim() && !contentPlain.trim()) {
      setError('Note cannot be empty');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        title: title.trim() || null,
        content,
        content_plain: contentPlain || null,
        visibility,
        meeting_url: meetingUrl.trim() || null,
        is_pinned: false,
      };

      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }

      const saved = await res.json();

      // Create any pending test case links
      if (linkedTestCases.length > 0) {
        await Promise.allSettled(
          linkedTestCases.map((tc) =>
            fetch(`/api/notes/${saved.id}/links`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ test_case_id: tc.id }),
            }),
          ),
        );
      }

      resetForm();
      setToast(true);
      setPanelOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [title, content, contentPlain, visibility, meetingUrl, resetForm]);

  const handleFileUpload = useCallback(async (files: FileList) => {
    if (!savedId) {
      setSaving(true);
      setError(null);
      try {
        const payload = {
          title: title.trim() || null,
          content,
          content_plain: contentPlain || null,
          visibility,
          meeting_url: meetingUrl.trim() || null,
        };
        const res = await fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Failed to save note');
        const saved = await res.json();
        setSavedId(saved.id);
        await uploadFiles(files, saved.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed');
      } finally {
        setSaving(false);
      }
      return;
    }
    await uploadFiles(files, savedId);
  }, [savedId, title, content, contentPlain, visibility, meetingUrl]);

  const uploadFiles = async (files: FileList, noteId: string) => {
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('note_id', noteId);
        const res = await fetch('/api/notes/upload', { method: 'POST', body: formData });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || `Upload failed: ${file.name}`);
        }
        const att = await res.json();
        setAttachments((prev) => [...prev, att]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleEditorChange = useCallback((html: string, plainText: string) => {
    setContent(html);
    setContentPlain(plainText);
  }, []);

  const handleTcSearch = useCallback(async (value: string) => {
    setTcSearch(value);
    if (!value.trim()) {
      setTcSearchResults([]);
      setTcSearchOpen(false);
      return;
    }
    setTcSearchLoading(true);
    try {
      const res = await fetch(`/api/test-cases?search=${encodeURIComponent(value)}`);
      if (res.ok) {
        const data: TestCase[] = await res.json();
        const alreadyLinked = new Set(linkedTestCases.map((tc) => tc.id));
        setTcSearchResults(data.filter((tc) => !alreadyLinked.has(tc.id)).slice(0, 8));
        setTcSearchOpen(true);
      }
    } catch {
      // ignore
    } finally {
      setTcSearchLoading(false);
    }
  }, [linkedTestCases]);

  const handleSelectTestCase = useCallback((tc: TestCase) => {
    setLinkedTestCases((prev) => {
      if (prev.some((l) => l.id === tc.id)) return prev;
      const projectId = (tc as TestCase & { suite?: { project_id: string } }).suite?.project_id ?? '';
      return [...prev, { id: tc.id, display_id: tc.display_id, title: tc.title, suite_id: tc.suite_id, project_id: projectId }];
    });
    setTcSearch('');
    setTcSearchResults([]);
    setTcSearchOpen(false);
  }, []);

  if (!canWrite) return null;
  if (!pos) return null; // wait for client-side mount

  return (
    <>
      {/* Outer container: fixed position, drag handle */}
      <Box
        ref={fabRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        sx={{
          position: 'fixed',
          right: `${pos.right}px`,
          bottom: `${pos.bottom}px`,
          zIndex: 1200,
          width: `${FAB_SIZE}px`,
          height: `${FAB_SIZE}px`,
          cursor: didDrag.current ? 'grabbing' : 'grab',
          touchAction: 'none',
          userSelect: 'none',
        }}
      >
        {/* Panel: positioned absolutely above/beside the FAB so it never goes off-screen */}
        <AnimatePresence>
          {panelOpen && (
            <motion.div
              style={{
                position: 'absolute',
                bottom: `${FAB_SIZE + 12}px`,
                right: 0,
              }}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <Paper
                elevation={12}
                sx={{
                  width: 400,
                  maxHeight: '70vh',
                  borderRadius: '12px',
                  border: `1px solid ${palette.divider}`,
                  bgcolor: palette.background.paper,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  cursor: 'default',
                }}
              >
                {/* Panel header */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    px: 2,
                    py: 1.25,
                    borderBottom: `1px solid ${palette.divider}`,
                    bgcolor: palette.background.surface2,
                  }}
                >
                  <EditNoteIcon sx={{ fontSize: 18, mr: 1, color: palette.primary.main }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, flex: 1 }}>
                    Quick Note
                  </Typography>
                  <IconButton size="small" onClick={() => { setPanelOpen(false); resetForm(); }}>
                    <CloseIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Box>

                {/* Panel body */}
                <Box sx={{ flex: 1, overflow: 'auto', px: 2, py: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {error && (
                    <Alert severity="error" onClose={() => setError(null)} sx={{ py: 0 }}>
                      <Typography variant="caption">{error}</Typography>
                    </Alert>
                  )}

                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Title (optional)"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    variant="standard"
                    slotProps={{ input: { sx: { fontSize: '0.9rem', fontWeight: 500 }, disableUnderline: true } }}
                  />

                  <NoteEditor
                    content={content}
                    onChange={handleEditorChange}
                    placeholder="Write your notes here..."
                    minHeight={120}
                    compact
                  />

                  {/* Controls */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                    <Chip
                      icon={visibility === 'team' ? <PublicIcon sx={{ fontSize: 13 }} /> : <LockOutlinedIcon sx={{ fontSize: 13 }} />}
                      label={visibility === 'team' ? 'Shared' : 'Private'}
                      size="small"
                      onClick={() => setVisibility((v) => v === 'private' ? 'team' : 'private')}
                      sx={{
                        height: 24,
                        fontSize: '0.7rem',
                        cursor: 'pointer',
                        bgcolor: visibility === 'team'
                          ? alpha(palette.success.main, 0.12)
                          : alpha(palette.neutral.main, 0.12),
                        color: visibility === 'team' ? palette.success.main : palette.neutral.light,
                      }}
                    />
                    <Tooltip title="Meeting URL">
                      <IconButton size="small" onClick={() => setShowMeetingUrl((s) => !s)}>
                        <LinkIcon sx={{ fontSize: 16, color: meetingUrl ? palette.info.main : undefined }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Attach file">
                      <IconButton
                        size="small"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                      >
                        {uploading
                          ? <CircularProgress size={14} />
                          : <AttachFileIcon sx={{ fontSize: 16 }} />
                        }
                      </IconButton>
                    </Tooltip>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      hidden
                      onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                    />
                  </Box>

                  <Collapse in={showMeetingUrl}>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="https://meet.google.com/..."
                      value={meetingUrl}
                      onChange={(e) => setMeetingUrl(e.target.value)}
                      slotProps={{
                        input: {
                          startAdornment: <LinkIcon sx={{ fontSize: 16, mr: 0.75, color: palette.text.secondary }} />,
                          sx: { fontSize: '0.75rem' },
                        },
                      }}
                    />
                  </Collapse>

                  {/* Attachment list */}
                  {attachments.length > 0 && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      {attachments.map((att) => (
                        <Box
                          key={att.id}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.75,
                            px: 1,
                            py: 0.5,
                            borderRadius: '4px',
                            bgcolor: palette.background.surface2,
                            border: `1px solid ${palette.divider}`,
                          }}
                        >
                          <InsertDriveFileOutlinedIcon sx={{ fontSize: 14, color: palette.info.main }} />
                          <Typography variant="caption" sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {att.file_name}
                          </Typography>
                          <IconButton
                            size="small"
                            onClick={() => setAttachments((prev) => prev.filter((a) => a.id !== att.id))}
                            sx={{ p: 0.25 }}
                          >
                            <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Box>
                      ))}
                    </Box>
                  )}

                  {/* Test case linking */}
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
                      <AssignmentOutlinedIcon sx={{ fontSize: 14, color: palette.text.secondary }} />
                      <Typography variant="caption" sx={{ fontWeight: 600, color: palette.text.secondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Test Cases
                      </Typography>
                    </Box>

                    {/* Linked chips */}
                    {linkedTestCases.length > 0 && (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 0.75 }}>
                        {linkedTestCases.map((tc) => (
                          <Chip
                            key={tc.id}
                            label={`${tc.display_id} · ${tc.title}`}
                            size="small"
                            onDelete={() => setLinkedTestCases((prev) => prev.filter((l) => l.id !== tc.id))}
                            sx={{
                              height: 20,
                              fontSize: '0.7rem',
                              maxWidth: 200,
                              bgcolor: alpha(palette.primary.main, 0.1),
                              color: palette.primary.light,
                              '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' },
                            }}
                          />
                        ))}
                      </Box>
                    )}

                    {/* Search */}
                    <Box sx={{ position: 'relative' }}>
                      <TextField
                        fullWidth
                        size="small"
                        placeholder="Link a test case (e.g. SR-12)…"
                        value={tcSearch}
                        onChange={(e) => handleTcSearch(e.target.value)}
                        onBlur={() => setTimeout(() => setTcSearchOpen(false), 150)}
                        onFocus={() => tcSearchResults.length > 0 && setTcSearchOpen(true)}
                        slotProps={{
                          input: {
                            startAdornment: (
                              <InputAdornment position="start">
                                {tcSearchLoading
                                  ? <CircularProgress size={12} />
                                  : <SearchIcon sx={{ fontSize: 14 }} />
                                }
                              </InputAdornment>
                            ),
                            sx: { fontSize: '0.75rem' },
                          },
                        }}
                      />
                      {tcSearchOpen && tcSearchResults.length > 0 && (
                        <Paper
                          elevation={8}
                          sx={{
                            position: 'absolute',
                            bottom: '100%',
                            left: 0,
                            right: 0,
                            mb: 0.5,
                            zIndex: 10,
                            border: `1px solid ${palette.divider}`,
                            bgcolor: palette.background.paper,
                            maxHeight: 180,
                            overflow: 'auto',
                          }}
                        >
                          <List dense disablePadding>
                            {tcSearchResults.map((tc) => (
                              <ListItemButton
                                key={tc.id}
                                onMouseDown={() => handleSelectTestCase(tc)}
                                sx={{ py: 0.5 }}
                              >
                                <ListItemText
                                  primary={
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                      <Chip
                                        label={tc.display_id}
                                        size="small"
                                        sx={{ height: 16, fontSize: '0.6rem', bgcolor: alpha(palette.primary.main, 0.12), color: palette.primary.light }}
                                      />
                                      <Typography variant="caption" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {tc.title}
                                      </Typography>
                                    </Box>
                                  }
                                />
                              </ListItemButton>
                            ))}
                          </List>
                        </Paper>
                      )}
                    </Box>
                  </Box>
                </Box>

                {/* Panel footer */}
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: 1,
                    px: 2,
                    py: 1.25,
                    borderTop: `1px solid ${palette.divider}`,
                  }}
                >
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => { setPanelOpen(false); resetForm(); }}
                    sx={{ textTransform: 'none', fontSize: '0.8125rem' }}
                  >
                    Discard
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    onClick={handleSave}
                    disabled={saving}
                    startIcon={saving ? <CircularProgress size={14} /> : undefined}
                    sx={{ textTransform: 'none', fontSize: '0.8125rem' }}
                  >
                    {saving ? 'Saving...' : 'Save Note'}
                  </Button>
                </Box>
              </Paper>
            </motion.div>
          )}
        </AnimatePresence>

        <Fab
          color="primary"
          onClick={() => {
            if (!didDrag.current) setPanelOpen((o) => !o);
          }}
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: `${FAB_SIZE}px`,
            height: `${FAB_SIZE}px`,
            boxShadow: `0 4px 20px ${alpha(palette.primary.main, 0.35)}`,
            cursor: 'inherit',
            pointerEvents: 'auto',
          }}
        >
          {panelOpen ? <CloseIcon /> : <EditNoteIcon />}
        </Fab>
      </Box>

      <Snackbar
        open={toast}
        autoHideDuration={3000}
        onClose={() => setToast(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        message="Note saved"
      />
    </>
  );
}
