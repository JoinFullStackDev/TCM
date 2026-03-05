'use client';

import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import Chip from '@mui/material/Chip';
import { alpha } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import LinkIcon from '@mui/icons-material/Link';
import { palette } from '@/theme/palette';
import type { BugLink } from '@/types/database';

interface BugLinksListProps {
  testCaseId: string | null;
  readOnly?: boolean;
}

export default function BugLinksList({ testCaseId, readOnly }: BugLinksListProps) {
  const [links, setLinks] = useState<BugLink[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchLinks = useCallback(async () => {
    if (!testCaseId) return;
    const res = await fetch(`/api/test-cases/${testCaseId}/bug-links`);
    if (res.ok) setLinks(await res.json());
  }, [testCaseId]);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  const handleAdd = async () => {
    if (!testCaseId || !url.trim()) return;
    setSaving(true);
    setError('');

    try {
      const res = await fetch(`/api/test-cases/${testCaseId}/bug-links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), title: title.trim() || null }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to add link');
        return;
      }

      setUrl('');
      setTitle('');
      setShowForm(false);
      fetchLinks();
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (linkId: string) => {
    if (!testCaseId) return;
    await fetch(`/api/test-cases/${testCaseId}/bug-links/${linkId}`, {
      method: 'DELETE',
    });
    fetchLinks();
  };

  if (!testCaseId) return null;

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
        Bug Links ({links.length})
      </Typography>

      {links.map((link) => (
        <Box
          key={link.id}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            py: 0.75,
            px: 1,
            borderRadius: '4px',
            mb: 0.5,
            bgcolor: 'background.default',
          }}
        >
          <LinkIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          <Link
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            underline="hover"
            sx={{ flex: 1, fontSize: '0.8125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {link.title || link.url}
          </Link>
          <Chip
            label={link.provider}
            size="small"
            sx={{
              height: 18,
              fontSize: '0.6rem',
              bgcolor: alpha(palette.neutral.main, 0.12),
              color: palette.neutral.light,
            }}
          />
          {!readOnly && (
            <IconButton size="small" onClick={() => handleDelete(link.id)} sx={{ color: 'text.secondary' }}>
              <DeleteOutlineIcon sx={{ fontSize: 16 }} />
            </IconButton>
          )}
        </Box>
      ))}

      {!readOnly && (
        <>
          {showForm ? (
            <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <TextField
                label="URL"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                fullWidth
                size="small"
                autoFocus
                error={!!error}
                helperText={error}
              />
              <TextField
                label="Title (optional)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                fullWidth
                size="small"
              />
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  onClick={handleAdd}
                  variant="contained"
                  size="small"
                  disabled={saving || !url.trim()}
                >
                  {saving ? 'Adding...' : 'Add'}
                </Button>
                <Button onClick={() => { setShowForm(false); setError(''); }} size="small" color="inherit">
                  Cancel
                </Button>
              </Box>
            </Box>
          ) : (
            <Button
              startIcon={<AddIcon />}
              onClick={() => setShowForm(true)}
              size="small"
              sx={{ mt: 0.5 }}
            >
              Add Link
            </Button>
          )}
        </>
      )}
    </Box>
  );
}
