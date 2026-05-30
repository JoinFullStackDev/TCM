'use client';

import { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';
import type { DocFolder } from '@/types/database';

interface MoveDocModalProps {
  open: boolean;
  folders: DocFolder[];
  currentFolderId: string | null;
  onClose: () => void;
  onMove: (folderId: string | null) => void;
}

// Flatten folder tree for picker (indented by depth)
function flattenFolders(
  folders: DocFolder[],
  parentId: string | null = null,
  depth = 0,
): Array<{ folder: DocFolder; depth: number }> {
  const children = folders
    .filter((f) => f.parent_id === parentId)
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
  return children.flatMap((f) => [
    { folder: f, depth },
    ...flattenFolders(folders, f.id, depth + 1),
  ]);
}

export default function MoveDocModal({
  open,
  folders,
  currentFolderId,
  onClose,
  onMove,
}: MoveDocModalProps) {
  const [selectedId, setSelectedId] = useState<string | null>(currentFolderId);
  const flattened = flattenFolders(folders);

  const handleConfirm = () => {
    onMove(selectedId);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Move Document</DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        <List disablePadding>
          {/* No folder option */}
          <ListItemButton
            selected={selectedId === null}
            onClick={() => setSelectedId(null)}
            sx={{ pl: 2 }}
          >
            <ListItemIcon sx={{ minWidth: 28 }}>
              <InboxOutlinedIcon sx={{ fontSize: 18 }} />
            </ListItemIcon>
            <ListItemText
              primary="No folder (root)"
              primaryTypographyProps={{ fontSize: '0.8125rem' }}
            />
          </ListItemButton>

          {flattened.map(({ folder, depth }) => (
            <ListItemButton
              key={folder.id}
              selected={selectedId === folder.id}
              onClick={() => setSelectedId(folder.id)}
              sx={{ pl: 2 + depth * 1.5 }}
            >
              <ListItemIcon sx={{ minWidth: 28 }}>
                <FolderOutlinedIcon sx={{ fontSize: 18 }} />
              </ListItemIcon>
              <ListItemText
                primary={folder.name}
                primaryTypographyProps={{ fontSize: '0.8125rem' }}
              />
            </ListItemButton>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={selectedId === currentFolderId}
        >
          Move
        </Button>
      </DialogActions>
    </Dialog>
  );
}
