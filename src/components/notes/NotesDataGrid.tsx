'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import NextLink from 'next/link';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import InputAdornment from '@mui/material/InputAdornment';
import {
  DataGridPro,
  type GridColDef,
  type GridRenderCellParams,
  GridToolbarContainer,
} from '@mui/x-data-grid-pro';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import PushPinIcon from '@mui/icons-material/PushPin';
import PublicIcon from '@mui/icons-material/Public';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import LinkIcon from '@mui/icons-material/Link';
import { alpha } from '@mui/material/styles';
import { palette } from '@/theme/palette';
import { useAuth } from '@/components/providers/AuthProvider';
import NoteDrawer from './NoteDrawer';
import type { NoteWithAttachments } from '@/types/database';

type FilterMode = 'all' | 'mine' | 'team';

export default function NotesDataGrid() {
  const { profile, can } = useAuth();
  const [notes, setNotes] = useState<NoteWithAttachments[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerNoteId, setDrawerNoteId] = useState<string | undefined>();
  const [drawerCreateMode, setDrawerCreateMode] = useState(false);
  const [drawerReadOnly, setDrawerReadOnly] = useState(false);
  const canWrite = can('write');

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('filter', filter);
      if (search.trim()) params.set('search', search.trim());

      const res = await fetch(`/api/notes?${params}`);
      if (res.ok) {
        const data = await res.json();
        setNotes(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const handleOpenNote = useCallback((noteId: string, isOwn: boolean) => {
    setDrawerNoteId(noteId);
    setDrawerCreateMode(false);
    setDrawerReadOnly(!isOwn || !canWrite);
    setDrawerOpen(true);
  }, [canWrite]);

  const handleCreateNote = useCallback(() => {
    setDrawerNoteId(undefined);
    setDrawerCreateMode(true);
    setDrawerReadOnly(false);
    setDrawerOpen(true);
  }, []);

  const handleDeleteNote = useCallback(async (noteId: string) => {
    if (!confirm('Delete this note?')) return;
    try {
      await fetch(`/api/notes/${noteId}`, { method: 'DELETE' });
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    } catch {
      // ignore
    }
  }, []);

  const columns: GridColDef<NoteWithAttachments>[] = useMemo(() => [
    {
      field: 'is_pinned',
      headerName: '',
      width: 40,
      sortable: false,
      renderCell: (params: GridRenderCellParams<NoteWithAttachments>) => (
        params.row.is_pinned ? <PushPinIcon sx={{ fontSize: 16, color: palette.warning.main }} /> : null
      ),
    },
    {
      field: 'title',
      headerName: 'Title',
      flex: 1,
      minWidth: 200,
      renderCell: (params: GridRenderCellParams<NoteWithAttachments>) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 500,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: params.row.title ? palette.text.primary : palette.text.disabled,
            }}
          >
            {params.row.title || 'Untitled'}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'visibility',
      headerName: 'Visibility',
      width: 110,
      renderCell: (params: GridRenderCellParams<NoteWithAttachments>) => (
        <Chip
          icon={params.row.visibility === 'team'
            ? <PublicIcon sx={{ fontSize: 13 }} />
            : <LockOutlinedIcon sx={{ fontSize: 13 }} />
          }
          label={params.row.visibility === 'team' ? 'Shared' : 'Private'}
          size="small"
          sx={{
            height: 22,
            fontSize: '0.7rem',
            bgcolor: params.row.visibility === 'team'
              ? alpha(palette.success.main, 0.1)
              : alpha(palette.neutral.main, 0.1),
            color: params.row.visibility === 'team'
              ? palette.success.main
              : palette.neutral.light,
          }}
        />
      ),
    },
    {
      field: 'author',
      headerName: 'Author',
      width: 150,
      renderCell: (params: GridRenderCellParams<NoteWithAttachments>) => {
        const a = params.row.author;
        if (!a) return null;
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Avatar src={a.avatar_url ?? undefined} sx={{ width: 20, height: 20, fontSize: '0.6rem' }}>
              {a.full_name?.[0] ?? a.email?.[0]}
            </Avatar>
            <Typography variant="caption" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {a.full_name ?? a.email}
            </Typography>
          </Box>
        );
      },
    },
    {
      field: 'meeting_url',
      headerName: 'Meeting',
      width: 70,
      sortable: false,
      renderCell: (params: GridRenderCellParams<NoteWithAttachments>) =>
        params.row.meeting_url ? (
          <Tooltip title={params.row.meeting_url}>
            <IconButton
              size="small"
              component="a"
              href={params.row.meeting_url}
              target="_blank"
              rel="noopener"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              <LinkIcon sx={{ fontSize: 16, color: palette.info.main }} />
            </IconButton>
          </Tooltip>
        ) : null,
    },
    {
      field: 'summary',
      headerName: 'Summary',
      width: 70,
      sortable: false,
      renderCell: (params: GridRenderCellParams<NoteWithAttachments>) =>
        params.row.summary ? (
          <Tooltip title="Has AI summary">
            <AutoAwesomeIcon sx={{ fontSize: 16, color: palette.info.main }} />
          </Tooltip>
        ) : null,
    },
    {
      field: 'linked_test_cases',
      headerName: 'Test Cases',
      width: 150,
      sortable: false,
      renderCell: (params: GridRenderCellParams<NoteWithAttachments>) => {
        // API returns nested shape: [{ test_cases: { id, display_id, ..., suite: { project_id } } }]
        type RawLink = { test_cases: { id: string; display_id: string; title: string; suite_id: string; suite?: { project_id: string } } };
        const raw = (params.row.linked_test_cases ?? []) as unknown as RawLink[];
        const tcs = raw
          .map((r) => ({ ...r.test_cases, project_id: (r.test_cases as RawLink['test_cases'] & { suite?: { project_id: string } }).suite?.project_id ?? '' }))
          .filter(Boolean);
        if (!tcs.length) return null;
        return (
          <Box sx={{ display: 'flex', gap: 0.4, flexWrap: 'wrap', alignItems: 'center' }}>
            {tcs.slice(0, 3).map((tc) => (
              <Chip
                key={tc.id}
                label={tc.display_id}
                size="small"
                component={tc.project_id ? NextLink : 'div'}
                href={tc.project_id ? `/projects/${tc.project_id}/suites/${tc.suite_id}` : undefined}
                clickable={!!tc.project_id}
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
                sx={{
                  height: 18,
                  fontSize: '0.65rem',
                  bgcolor: alpha(palette.primary.main, 0.1),
                  color: palette.primary.light,
                  textDecoration: 'none',
                  '&:hover': tc.project_id ? { bgcolor: alpha(palette.primary.main, 0.2) } : {},
                }}
              />
            ))}
            {tcs.length > 3 && (
              <Chip
                label={`+${tcs.length - 3}`}
                size="small"
                sx={{ height: 18, fontSize: '0.65rem' }}
              />
            )}
          </Box>
        );
      },
    },
    {
      field: 'updated_at',
      headerName: 'Updated',
      width: 140,
      renderCell: (params: GridRenderCellParams<NoteWithAttachments>) => (
        <Typography variant="caption" sx={{ color: palette.text.secondary }}>
          {new Date(params.row.updated_at).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
          })}
        </Typography>
      ),
    },
    {
      field: 'actions',
      headerName: '',
      width: 80,
      sortable: false,
      renderCell: (params: GridRenderCellParams<NoteWithAttachments>) => {
        const isOwn = params.row.author_id === profile?.id;
        return (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title="Open">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenNote(params.row.id, isOwn);
                }}
              >
                <OpenInNewIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
            {isOwn && canWrite && (
              <Tooltip title="Delete">
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteNote(params.row.id);
                  }}
                >
                  <DeleteOutlineIcon sx={{ fontSize: 16, color: palette.error.main }} />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        );
      },
    },
  ], [profile?.id, canWrite, handleOpenNote, handleDeleteNote]);

  const Toolbar = useCallback(() => (
    <GridToolbarContainer sx={{ px: 1, py: 1, gap: 1.5 }}>
      {canWrite && (
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={handleCreateNote}
          variant="contained"
          sx={{ textTransform: 'none' }}
        >
          New Note
        </Button>
      )}
      <ToggleButtonGroup
        value={filter}
        exclusive
        onChange={(_, val) => val && setFilter(val)}
        size="small"
      >
        <ToggleButton value="all" sx={{ textTransform: 'none', fontSize: '0.75rem', px: 1.5 }}>
          All
        </ToggleButton>
        <ToggleButton value="mine" sx={{ textTransform: 'none', fontSize: '0.75rem', px: 1.5 }}>
          My Notes
        </ToggleButton>
        <ToggleButton value="team" sx={{ textTransform: 'none', fontSize: '0.75rem', px: 1.5 }}>
          Team Notes
        </ToggleButton>
      </ToggleButtonGroup>
      <Box sx={{ flex: 1 }} />
      <TextField
        size="small"
        placeholder="Search notes..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 18 }} />
              </InputAdornment>
            ),
            sx: { fontSize: '0.8125rem' },
          },
        }}
        sx={{ width: 240 }}
      />
    </GridToolbarContainer>
  ), [filter, search, canWrite, handleCreateNote]);

  return (
    <>
      <DataGridPro
        rows={notes}
        columns={columns}
        loading={loading}
        getRowId={(row) => row.id}
        onRowClick={(params) => {
          const isOwn = params.row.author_id === profile?.id;
          handleOpenNote(params.row.id, isOwn);
        }}
        slots={{ toolbar: Toolbar }}
        density="compact"
        disableRowSelectionOnClick
        initialState={{
          sorting: {
            sortModel: [{ field: 'updated_at', sort: 'desc' }],
          },
        }}
        sx={{
          border: 'none',
          '& .MuiDataGrid-row': { cursor: 'pointer' },
          '& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within': { outline: 'none' },
        }}
        autoHeight
      />
      <NoteDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        noteId={drawerNoteId}
        createMode={drawerCreateMode}
        readOnly={drawerReadOnly}
        onSaved={() => {
          fetchNotes();
          setDrawerOpen(false);
        }}
      />
    </>
  );
}
