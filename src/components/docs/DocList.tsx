'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import type { DocSummary } from '@/types/database';
import type { UseDocsReturn } from '@/hooks/useDocs';
import { useAuth } from '@/components/providers/AuthProvider';

interface DocListProps {
  docs: DocSummary[];
  selectedDocId: string | null;
  selectedFolderId: string | null;
  onSelectDoc: UseDocsReturn['selectDoc'];
  onCreateDoc: UseDocsReturn['createDoc'];
  onDeleteDoc: UseDocsReturn['deleteDoc'];
  onOpenMoveModal: (docId: string) => void;
}

export default function DocList({
  docs,
  selectedDocId,
  selectedFolderId,
  onSelectDoc,
  onCreateDoc,
  onDeleteDoc,
  onOpenMoveModal,
}: DocListProps) {
  const { can } = useAuth();
  const canWrite = can('write');

  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [menuDocId, setMenuDocId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const openMenu = (e: React.MouseEvent<HTMLElement>, docId: string) => {
    e.stopPropagation();
    setMenuAnchor(e.currentTarget);
    setMenuDocId(docId);
  };

  const closeMenu = () => {
    setMenuAnchor(null);
    setMenuDocId(null);
  };

  const handleCopyLink = (docId: string) => {
    const url = `${window.location.origin}/docs?docId=${docId}`;
    void navigator.clipboard.writeText(url);
    closeMenu();
  };

  const handleMoveDoc = (docId: string) => {
    closeMenu();
    onOpenMoveModal(docId);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId) return;
    await onDeleteDoc(deleteConfirmId);
    setDeleteConfirmId(null);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, flex: 1, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {selectedFolderId ? 'Documents' : 'All Documents'}
        </Typography>
        {canWrite && (
          <Tooltip title="New document">
            <IconButton size="small" onClick={() => onCreateDoc(selectedFolderId)}>
              <AddIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* Doc list */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {docs.length === 0 ? (
          <Box sx={{ px: 2, py: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No documents yet
            </Typography>
            {canWrite && (
              <Typography variant="caption" color="text.secondary">
                Click + to create one
              </Typography>
            )}
          </Box>
        ) : (
          <List disablePadding>
            {docs.map((doc) => (
              <ListItemButton
                key={doc.id}
                selected={selectedDocId === doc.id}
                onClick={() => onSelectDoc(doc.id)}
                sx={{
                  px: 2,
                  py: 1,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  '&:hover .doc-actions': { opacity: 1 },
                  alignItems: 'flex-start',
                }}
              >
                <ListItemText
                  primary={doc.title}
                  secondary={new Date(doc.updated_at).toLocaleDateString()}
                  primaryTypographyProps={{
                    fontSize: '0.8125rem',
                    fontWeight: selectedDocId === doc.id ? 600 : 400,
                    noWrap: true,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  secondaryTypographyProps={{ fontSize: '0.7rem' }}
                />
                <Box
                  className="doc-actions"
                  onClick={(e) => e.stopPropagation()}
                  sx={{ display: 'flex', alignItems: 'center', opacity: 0, transition: 'opacity 0.15s', flexShrink: 0, ml: 0.5 }}
                >
                  <Tooltip title="More actions">
                    <IconButton size="small" onClick={(e) => openMenu(e, doc.id)} sx={{ p: 0.25 }}>
                      <MoreVertIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                  {canWrite && (
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        sx={{ p: 0.25, color: 'error.main' }}
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(doc.id); }}
                      >
                        <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              </ListItemButton>
            ))}
          </List>
        )}
      </Box>

      {/* Context menu */}
      <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={closeMenu}>
        <MenuItem onClick={() => menuDocId && handleCopyLink(menuDocId)}>Copy link</MenuItem>
        {canWrite && (
          <MenuItem onClick={() => menuDocId && handleMoveDoc(menuDocId)}>Move to…</MenuItem>
        )}
      </Menu>

      {/* Delete confirm */}
      <Dialog open={!!deleteConfirmId} onClose={() => setDeleteConfirmId(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Document</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to permanently delete this document? This cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDeleteConfirm}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
