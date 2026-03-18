'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';
import Avatar from '@mui/material/Avatar';
import Collapse from '@mui/material/Collapse';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import CloseIcon from '@mui/icons-material/Close';
import PushPinIcon from '@mui/icons-material/PushPin';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import PublicIcon from '@mui/icons-material/Public';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import LinkIcon from '@mui/icons-material/Link';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DownloadIcon from '@mui/icons-material/Download';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import InputAdornment from '@mui/material/InputAdornment';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import { alpha } from '@mui/material/styles';
import SearchIcon from '@mui/icons-material/Search';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import NextLink from 'next/link';
import NoteEditor from './NoteEditor';
import { palette } from '@/theme/palette';
import type { NoteWithAttachments, NoteAttachment, LinkedTestCase, TestCase } from '@/types/database';

interface NoteDrawerProps {
  open: boolean;
  onClose: () => void;
  noteId?: string;
  createMode?: boolean;
  readOnly?: boolean;
  onSaved?: () => void;
}

export default function NoteDrawer({
  open,
  onClose,
  noteId,
  createMode = false,
  readOnly = false,
  onSaved,
}: NoteDrawerProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [contentPlain, setContentPlain] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'team'>('private');
  const [isPinned, setIsPinned] = useState(false);
  const [meetingUrl, setMeetingUrl] = useState('');
  const [showMeetingUrl, setShowMeetingUrl] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [attachments, setAttachments] = useState<NoteAttachment[]>([]);
  const [author, setAuthor] = useState<NoteWithAttachments['author']>(undefined);
  const [saving, setSaving] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [savedNoteId, setSavedNoteId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Linked test cases
  const [linkedTestCases, setLinkedTestCases] = useState<LinkedTestCase[]>([]);
  const [tcSearch, setTcSearch] = useState('');
  const [tcSearchResults, setTcSearchResults] = useState<TestCase[]>([]);
  const [tcSearchOpen, setTcSearchOpen] = useState(false);
  const [tcSearchLoading, setTcSearchLoading] = useState(false);
  const [linkingTc, setLinkingTc] = useState(false);

  const resetForm = useCallback(() => {
    setTitle('');
    setContent('');
    setContentPlain('');
    setVisibility('private');
    setIsPinned(false);
    setMeetingUrl('');
    setShowMeetingUrl(false);
    setSummary(null);
    setShowSummary(false);
    setAttachments([]);
    setAuthor(undefined);
    setError(null);
    setCreatedAt(null);
    setUpdatedAt(null);
    setSavedNoteId(null);
    setLinkedTestCases([]);
    setTcSearch('');
    setTcSearchResults([]);
  }, []);

  useEffect(() => {
    if (!open) return;

    if (createMode) {
      resetForm();
      return;
    }

    if (!noteId) return;

    const fetchNote = async () => {
      try {
        // Fetch note and linked test cases in parallel
        const [noteRes, linksRes] = await Promise.all([
          fetch(`/api/notes/${noteId}`),
          fetch(`/api/notes/${noteId}/links`),
        ]);

        if (!noteRes.ok) throw new Error('Failed to load note');
        const note: NoteWithAttachments = await noteRes.json();
        setTitle(note.title ?? '');
        setContent(note.content);
        setContentPlain(note.content_plain ?? '');
        setVisibility(note.visibility);
        setIsPinned(note.is_pinned);
        setMeetingUrl(note.meeting_url ?? '');
        setShowMeetingUrl(!!note.meeting_url);
        setSummary(note.summary);
        setShowSummary(!!note.summary);
        setAttachments(note.note_attachments ?? []);
        setAuthor(note.author);
        setCreatedAt(note.created_at);
        setUpdatedAt(note.updated_at);
        setSavedNoteId(note.id);

        // Use the dedicated links endpoint — more reliable than the nested join
        if (linksRes.ok) {
          const links: LinkedTestCase[] = await linksRes.json();
          setLinkedTestCases(links);
        }
      } catch {
        setError('Failed to load note');
      }
    };

    fetchNote();
  }, [open, noteId, createMode, resetForm]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title: title.trim() || null,
        content,
        content_plain: contentPlain || null,
        visibility,
        meeting_url: meetingUrl.trim() || null,
        is_pinned: isPinned,
      };

      const isNew = createMode && !savedNoteId;
      const url = isNew ? '/api/notes' : `/api/notes/${savedNoteId || noteId}`;
      const method = isNew ? 'POST' : 'PATCH';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }

      const saved = await res.json();
      if (isNew) setSavedNoteId(saved.id);
      setUpdatedAt(saved.updated_at);
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [title, content, contentPlain, visibility, meetingUrl, isPinned, createMode, savedNoteId, noteId, onSaved]);

  const handleSummarize = useCallback(async () => {
    const id = savedNoteId || noteId;
    if (!id) return;
    setSummarizing(true);
    try {
      const res = await fetch(`/api/notes/${id}/summarize`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Summarization failed');
      }
      const data = await res.json();
      setSummary(data.summary);
      setShowSummary(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Summarization failed');
    } finally {
      setSummarizing(false);
    }
  }, [savedNoteId, noteId]);

  const handleFileUpload = useCallback(async (files: FileList) => {
    const id = savedNoteId || noteId;
    if (!id) {
      setError('Save the note first before attaching files');
      return;
    }
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('note_id', id);

        const res = await fetch('/api/notes/upload', { method: 'POST', body: formData });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || `Failed to upload ${file.name}`);
        }
        const attachment = await res.json();
        setAttachments((prev) => [...prev, attachment]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [savedNoteId, noteId]);

  const handleDeleteAttachment = useCallback(async (attachmentId: string) => {
    const id = savedNoteId || noteId;
    if (!id) return;
    try {
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
    } catch {
      setError('Failed to delete attachment');
    }
  }, [savedNoteId, noteId]);

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

  const handleLinkTestCase = useCallback(async (tc: TestCase) => {
    const id = savedNoteId || noteId;
    if (!id) return;
    setLinkingTc(true);
    setTcSearchOpen(false);
    setTcSearch('');
    setTcSearchResults([]);
    try {
      const res = await fetch(`/api/notes/${id}/links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test_case_id: tc.id }),
      });
      if (!res.ok) {
        const data = await res.json();
        if (data.error !== 'Already linked') throw new Error(data.error);
      }
      setLinkedTestCases((prev) => {
        if (prev.some((l) => l.id === tc.id)) return prev;
        const projectId = (tc as TestCase & { suite?: { project_id: string } }).suite?.project_id ?? '';
        return [...prev, { id: tc.id, display_id: tc.display_id, title: tc.title, suite_id: tc.suite_id, project_id: projectId }];
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link test case');
    } finally {
      setLinkingTc(false);
    }
  }, [savedNoteId, noteId]);

  const handleUnlinkTestCase = useCallback(async (tcId: string) => {
    const id = savedNoteId || noteId;
    if (!id) return;
    try {
      await fetch(`/api/notes/${id}/links`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test_case_id: tcId }),
      });
      setLinkedTestCases((prev) => prev.filter((tc) => tc.id !== tcId));
    } catch {
      setError('Failed to unlink test case');
    }
  }, [savedNoteId, noteId]);

  const effectiveReadOnly = readOnly || false;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 650 },
          bgcolor: palette.background.default,
          backgroundImage: 'none',
        },
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 2.5,
            py: 1.5,
            borderBottom: `1px solid ${palette.divider}`,
          }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 600, flex: 1 }}>
            {createMode && !savedNoteId ? 'New Note' : 'Edit Note'}
          </Typography>

          {author && !createMode && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Avatar
                src={author.avatar_url ?? undefined}
                sx={{ width: 22, height: 22, fontSize: '0.65rem' }}
              >
                {author.full_name?.[0] ?? author.email?.[0]}
              </Avatar>
              <Typography variant="caption" sx={{ color: palette.text.secondary }}>
                {author.full_name ?? author.email}
              </Typography>
            </Box>
          )}

          <IconButton size="small" onClick={onClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Body */}
        <Box sx={{ flex: 1, overflow: 'auto', px: 2.5, py: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {error && (
            <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 1 }}>
              {error}
            </Alert>
          )}

          {/* Title */}
          <TextField
            fullWidth
            placeholder="Note title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={effectiveReadOnly}
            variant="standard"
            slotProps={{
              input: {
                sx: { fontSize: '1.25rem', fontWeight: 600 },
                disableUnderline: effectiveReadOnly,
              },
            }}
          />

          {/* Controls row */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            {!effectiveReadOnly && (
              <>
                <Chip
                  icon={visibility === 'team' ? <PublicIcon sx={{ fontSize: 14 }} /> : <LockOutlinedIcon sx={{ fontSize: 14 }} />}
                  label={visibility === 'team' ? 'Shared' : 'Private'}
                  size="small"
                  onClick={() => setVisibility((v) => v === 'private' ? 'team' : 'private')}
                  sx={{
                    height: 26,
                    fontSize: '0.75rem',
                    bgcolor: visibility === 'team'
                      ? alpha(palette.success.main, 0.12)
                      : alpha(palette.neutral.main, 0.12),
                    color: visibility === 'team' ? palette.success.main : palette.neutral.light,
                    cursor: 'pointer',
                    '&:hover': {
                      bgcolor: visibility === 'team'
                        ? alpha(palette.success.main, 0.2)
                        : alpha(palette.neutral.main, 0.2),
                    },
                  }}
                />
                <Tooltip title={isPinned ? 'Unpin' : 'Pin note'}>
                  <IconButton size="small" onClick={() => setIsPinned((p) => !p)}>
                    {isPinned
                      ? <PushPinIcon sx={{ fontSize: 18, color: palette.warning.main }} />
                      : <PushPinOutlinedIcon sx={{ fontSize: 18 }} />
                    }
                  </IconButton>
                </Tooltip>
                <Tooltip title="Meeting URL">
                  <IconButton size="small" onClick={() => setShowMeetingUrl((s) => !s)}>
                    <LinkIcon sx={{ fontSize: 18, color: meetingUrl ? palette.info.main : undefined }} />
                  </IconButton>
                </Tooltip>
              </>
            )}

            {effectiveReadOnly && (
              <>
                <Chip
                  icon={visibility === 'team' ? <PublicIcon sx={{ fontSize: 14 }} /> : <LockOutlinedIcon sx={{ fontSize: 14 }} />}
                  label={visibility === 'team' ? 'Shared' : 'Private'}
                  size="small"
                  sx={{ height: 26, fontSize: '0.75rem' }}
                />
                {isPinned && (
                  <PushPinIcon sx={{ fontSize: 16, color: palette.warning.main }} />
                )}
              </>
            )}
          </Box>

          {/* Meeting URL */}
          <Collapse in={showMeetingUrl}>
            <TextField
              fullWidth
              size="small"
              placeholder="https://meet.google.com/..."
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
              disabled={effectiveReadOnly}
              slotProps={{
                input: {
                  startAdornment: <LinkIcon sx={{ fontSize: 18, mr: 1, color: palette.text.secondary }} />,
                  sx: { fontSize: '0.8125rem' },
                },
              }}
            />
          </Collapse>

          <Divider />

          {/* Editor */}
          <NoteEditor
            content={content}
            onChange={handleEditorChange}
            readOnly={effectiveReadOnly}
            minHeight={250}
          />

          {/* Attachments */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, color: palette.text.secondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Attachments ({attachments.length})
              </Typography>
              {!effectiveReadOnly && (
                <>
                  <Tooltip title="Attach files">
                    <IconButton
                      size="small"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading || (!savedNoteId && !noteId)}
                    >
                      {uploading
                        ? <CircularProgress size={16} />
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
                </>
              )}
            </Box>
            {attachments.length > 0 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {attachments.map((att) => (
                  <Box
                    key={att.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      px: 1.5,
                      py: 0.75,
                      borderRadius: '6px',
                      bgcolor: palette.background.surface2,
                      border: `1px solid ${palette.divider}`,
                    }}
                  >
                    <InsertDriveFileOutlinedIcon sx={{ fontSize: 18, color: palette.info.main }} />
                    <Typography variant="body2" sx={{ flex: 1, fontSize: '0.8125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {att.file_name}
                    </Typography>
                    {att.file_size && (
                      <Typography variant="caption" sx={{ color: palette.text.disabled }}>
                        {(att.file_size / 1024).toFixed(0)}KB
                      </Typography>
                    )}
                    <Tooltip title="Download">
                      <IconButton size="small">
                        <DownloadIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                    {!effectiveReadOnly && (
                      <Tooltip title="Remove">
                        <IconButton size="small" onClick={() => handleDeleteAttachment(att.id)}>
                          <DeleteOutlineIcon sx={{ fontSize: 16, color: palette.error.main }} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                ))}
              </Box>
            )}
            {!effectiveReadOnly && !savedNoteId && !noteId && (
              <Typography variant="caption" sx={{ color: palette.text.disabled }}>
                Save the note first to attach files
              </Typography>
            )}
          </Box>

          <Divider />

          {/* Linked Test Cases */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <AssignmentOutlinedIcon sx={{ fontSize: 16, color: palette.text.secondary }} />
              <Typography variant="caption" sx={{ fontWeight: 600, color: palette.text.secondary, textTransform: 'uppercase', letterSpacing: '0.05em', flex: 1 }}>
                Linked Test Cases ({linkedTestCases.length})
              </Typography>
              {linkingTc && <CircularProgress size={14} />}
            </Box>

            {/* Linked chips */}
            {linkedTestCases.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1 }}>
                {linkedTestCases.map((tc) => (
                  <Chip
                    key={tc.id}
                    label={`${tc.display_id} · ${tc.title}`}
                    size="small"
                    component={tc.project_id ? NextLink : 'div'}
                    href={tc.project_id ? `/projects/${tc.project_id}/suites/${tc.suite_id}` : undefined}
                    clickable={!!tc.project_id}
                    onDelete={effectiveReadOnly ? undefined : () => handleUnlinkTestCase(tc.id)}
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    sx={{
                      height: 24,
                      fontSize: '0.75rem',
                      maxWidth: 260,
                      bgcolor: alpha(palette.primary.main, 0.1),
                      color: palette.primary.light,
                      textDecoration: 'none',
                      '&:hover': tc.project_id ? { bgcolor: alpha(palette.primary.main, 0.18) } : {},
                      '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' },
                    }}
                  />
                ))}
              </Box>
            )}

            {/* Search input */}
            {!effectiveReadOnly && (
              <Box sx={{ position: 'relative' }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder={savedNoteId || noteId ? 'Search by ID or title (e.g. SR-12)…' : 'Save note first to link test cases'}
                  value={tcSearch}
                  onChange={(e) => handleTcSearch(e.target.value)}
                  disabled={!savedNoteId && !noteId}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          {tcSearchLoading
                            ? <CircularProgress size={14} />
                            : <SearchIcon sx={{ fontSize: 16 }} />
                          }
                        </InputAdornment>
                      ),
                      sx: { fontSize: '0.8125rem' },
                    },
                  }}
                  onBlur={() => setTimeout(() => setTcSearchOpen(false), 150)}
                  onFocus={() => tcSearchResults.length > 0 && setTcSearchOpen(true)}
                />
                {tcSearchOpen && tcSearchResults.length > 0 && (
                  <Paper
                    elevation={8}
                    sx={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      mt: 0.5,
                      zIndex: 10,
                      border: `1px solid ${palette.divider}`,
                      bgcolor: palette.background.paper,
                      maxHeight: 220,
                      overflow: 'auto',
                    }}
                  >
                    <List dense disablePadding>
                      {tcSearchResults.map((tc) => (
                        <ListItemButton
                          key={tc.id}
                          onMouseDown={() => handleLinkTestCase(tc)}
                          sx={{ py: 0.75 }}
                        >
                          <ListItemText
                            primary={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Chip
                                  label={tc.display_id}
                                  size="small"
                                  sx={{ height: 18, fontSize: '0.65rem', bgcolor: alpha(palette.primary.main, 0.12), color: palette.primary.light }}
                                />
                                <Typography variant="body2" sx={{ fontSize: '0.8125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
            )}
          </Box>

          <Divider />

          {/* AI Summary */}
          <Box>
            <Box
              sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}
              onClick={() => setShowSummary((s) => !s)}
            >
              <AutoAwesomeIcon sx={{ fontSize: 18, color: palette.info.main }} />
              <Typography variant="caption" sx={{ fontWeight: 600, color: palette.text.secondary, textTransform: 'uppercase', letterSpacing: '0.05em', flex: 1 }}>
                AI Summary
              </Typography>
              {showSummary ? <ExpandLessIcon sx={{ fontSize: 18 }} /> : <ExpandMoreIcon sx={{ fontSize: 18 }} />}
            </Box>
            <Collapse in={showSummary}>
              <Box sx={{ mt: 1 }}>
                {summary ? (
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: '6px',
                      bgcolor: alpha(palette.info.main, 0.06),
                      border: `1px solid ${alpha(palette.info.main, 0.15)}`,
                    }}
                  >
                    <Typography variant="body2" sx={{ fontSize: '0.8125rem', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                      {summary}
                    </Typography>
                  </Box>
                ) : (
                  <Typography variant="caption" sx={{ color: palette.text.disabled }}>
                    No summary generated yet.
                  </Typography>
                )}
                {!effectiveReadOnly && (
                  <Button
                    size="small"
                    startIcon={summarizing ? <CircularProgress size={14} /> : <AutoAwesomeIcon sx={{ fontSize: 14 }} />}
                    onClick={handleSummarize}
                    disabled={summarizing || (!savedNoteId && !noteId)}
                    sx={{ mt: 1, textTransform: 'none', fontSize: '0.75rem' }}
                  >
                    {summary ? 'Regenerate summary' : 'Generate summary'}
                  </Button>
                )}
              </Box>
            </Collapse>
          </Box>

          {/* Metadata */}
          {(createdAt || updatedAt) && (
            <>
              <Divider />
              <Box sx={{ display: 'flex', gap: 3 }}>
                {createdAt && (
                  <Typography variant="caption" sx={{ color: palette.text.disabled }}>
                    Created {new Date(createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </Typography>
                )}
                {updatedAt && (
                  <Typography variant="caption" sx={{ color: palette.text.disabled }}>
                    Updated {new Date(updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </Typography>
                )}
              </Box>
            </>
          )}
        </Box>

        {/* Footer */}
        {!effectiveReadOnly && (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 1,
              px: 2.5,
              py: 1.5,
              borderTop: `1px solid ${palette.divider}`,
            }}
          >
            <Button variant="outlined" size="small" onClick={onClose} sx={{ textTransform: 'none' }}>
              Cancel
            </Button>
            <Button
              variant="contained"
              size="small"
              onClick={handleSave}
              disabled={saving}
              startIcon={saving ? <CircularProgress size={14} /> : undefined}
              sx={{ textTransform: 'none' }}
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </Box>
        )}
      </Box>
    </Drawer>
  );
}
