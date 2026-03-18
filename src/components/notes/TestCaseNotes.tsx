'use client';

import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import { alpha } from '@mui/material/styles';
import PublicIcon from '@mui/icons-material/Public';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { palette } from '@/theme/palette';
import Link from 'next/link';
import NoteDrawer from './NoteDrawer';
import { useAuth } from '@/components/providers/AuthProvider';

interface NoteItem {
  id: string;
  title: string | null;
  content_plain: string | null;
  summary: string | null;
  visibility: 'private' | 'team';
  is_pinned: boolean;
  updated_at: string;
  author_id: string;
  author?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    email: string;
  };
}

interface TestCaseNotesProps {
  testCaseId: string;
}

export default function TestCaseNotes({ testCaseId }: TestCaseNotesProps) {
  const { profile } = useAuth();
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerNoteId, setDrawerNoteId] = useState<string | undefined>();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerReadOnly, setDrawerReadOnly] = useState(false);

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/test-cases/${testCaseId}/notes`);
      if (res.ok) {
        const data = await res.json();
        setNotes(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [testCaseId]);

  useEffect(() => {
    if (testCaseId) fetchNotes();
  }, [testCaseId, fetchNotes]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
        <CircularProgress size={14} />
        <Typography variant="caption" sx={{ color: palette.text.disabled }}>
          Loading notes...
        </Typography>
      </Box>
    );
  }

  if (notes.length === 0) {
    return (
      <Typography variant="caption" sx={{ color: palette.text.disabled }}>
        No notes linked to this test case yet.
      </Typography>
    );
  }

  return (
    <>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {notes.map((note) => (
          <Box
            key={note.id}
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 1.5,
              p: 1.25,
              borderRadius: '8px',
              bgcolor: palette.background.surface2,
              border: `1px solid ${palette.divider}`,
            }}
          >
            {note.author && (
              <Avatar
                src={note.author.avatar_url ?? undefined}
                sx={{ width: 24, height: 24, fontSize: '0.65rem', mt: 0.25 }}
              >
                {note.author.full_name?.[0] ?? note.author.email?.[0]}
              </Avatar>
            )}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.25 }}>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 500,
                    fontSize: '0.8125rem',
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: note.title ? palette.text.primary : palette.text.disabled,
                  }}
                >
                  {note.title || 'Untitled'}
                </Typography>
                <Chip
                  icon={note.visibility === 'team'
                    ? <PublicIcon sx={{ fontSize: 11 }} />
                    : <LockOutlinedIcon sx={{ fontSize: 11 }} />
                  }
                  label={note.visibility === 'team' ? 'Shared' : 'Private'}
                  size="small"
                  sx={{
                    height: 18,
                    fontSize: '0.65rem',
                    bgcolor: note.visibility === 'team'
                      ? alpha(palette.success.main, 0.1)
                      : alpha(palette.neutral.main, 0.1),
                    color: note.visibility === 'team' ? palette.success.main : palette.neutral.light,
                  }}
                />
                {note.summary && (
                  <Tooltip title="Has AI summary">
                    <AutoAwesomeIcon sx={{ fontSize: 14, color: palette.info.main }} />
                  </Tooltip>
                )}
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {note.author && (
                  <Typography variant="caption" sx={{ color: palette.text.disabled }}>
                    {note.author.full_name ?? note.author.email}
                  </Typography>
                )}
                <Typography variant="caption" sx={{ color: palette.text.disabled }}>
                  ·
                </Typography>
                <Typography variant="caption" sx={{ color: palette.text.disabled }}>
                  {new Date(note.updated_at).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric',
                  })}
                </Typography>
                {note.content_plain && (
                  <>
                    <Typography variant="caption" sx={{ color: palette.text.disabled }}>·</Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        color: palette.text.disabled,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: 160,
                      }}
                    >
                      {note.content_plain.slice(0, 80)}
                    </Typography>
                  </>
                )}
              </Box>
            </Box>
                <Tooltip title="Open note">
              <IconButton
                size="small"
                component={Link}
                href={`/profile?note=${note.id}`}
                onClick={(e: React.MouseEvent) => {
                  e.preventDefault();
                  setDrawerNoteId(note.id);
                  setDrawerReadOnly(note.author_id !== profile?.id);
                  setDrawerOpen(true);
                }}
              >
                <OpenInNewIcon sx={{ fontSize: 15 }} />
              </IconButton>
            </Tooltip>
          </Box>
        ))}
      </Box>

      <NoteDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        noteId={drawerNoteId}
        readOnly={drawerReadOnly}
        onSaved={fetchNotes}
      />
    </>
  );
}
