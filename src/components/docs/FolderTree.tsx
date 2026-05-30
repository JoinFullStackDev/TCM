'use client';

import { useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { DocFolder } from '@/types/database';
import type { UseDocsReturn } from '@/hooks/useDocs';
import { useAuth } from '@/components/providers/AuthProvider';

interface FolderTreeProps {
  folders: DocFolder[];
  selectedFolderId: string | null;
  onSelectFolder: UseDocsReturn['selectFolder'];
  onCreateFolder: UseDocsReturn['createFolder'];
  onRenameFolder: UseDocsReturn['renameFolder'];
  onDeleteFolder: UseDocsReturn['deleteFolder'];
  onMoveFolder: UseDocsReturn['moveFolder'];
  onReorderFolders: UseDocsReturn['reorderFolders'];
  /** Doc counts per folder for delete warnings */
  docCountByFolder?: Record<string, number>;
}

interface SortableFolderItemProps {
  folder: DocFolder;
  depth: number;
  isSelected: boolean;
  isExpanded: boolean;
  hasChildren: boolean;
  canWrite: boolean;
  canDelete: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onRename: (id: string) => void;
  onDelete: (id: string) => void;
  onAddChild: (parentId: string) => void;
  children?: React.ReactNode;
}

function SortableFolderItem({
  folder,
  depth,
  isSelected,
  isExpanded,
  hasChildren,
  canWrite,
  canDelete,
  onSelect,
  onToggle,
  onRename,
  onDelete,
  onAddChild,
  children,
}: SortableFolderItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: folder.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Box ref={setNodeRef} style={style} {...attributes}>
      <ListItemButton
        {...listeners}
        selected={isSelected}
        onClick={onSelect}
        sx={{
          pl: 1 + depth * 1.5,
          pr: 1,
          py: 0.5,
          minHeight: 36,
          borderRadius: '6px',
          mb: 0.25,
          '&:hover .folder-actions': { opacity: 1 },
        }}
      >
        <ListItemIcon sx={{ minWidth: 24 }} onClick={(e) => { e.stopPropagation(); onToggle(); }}>
          {hasChildren
            ? isExpanded
              ? <ExpandMoreIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              : <ChevronRightIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
            : <Box sx={{ width: 16 }} />
          }
        </ListItemIcon>
        <ListItemIcon sx={{ minWidth: 28 }}>
          {isExpanded && hasChildren
            ? <FolderOpenOutlinedIcon sx={{ fontSize: 18, color: isSelected ? 'primary.main' : 'text.secondary' }} />
            : <FolderOutlinedIcon sx={{ fontSize: 18, color: isSelected ? 'primary.main' : 'text.secondary' }} />
          }
        </ListItemIcon>
        <ListItemText
          primary={folder.name}
          primaryTypographyProps={{
            fontSize: '0.8125rem',
            fontWeight: isSelected ? 600 : 400,
            noWrap: true,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        />
        <Box
          className="folder-actions"
          onClick={(e) => e.stopPropagation()}
          sx={{ display: 'flex', opacity: 0, transition: 'opacity 0.15s' }}
        >
          {canWrite && (
            <Tooltip title="New subfolder">
              <IconButton size="small" onClick={() => onAddChild(folder.id)} sx={{ p: 0.25 }}>
                <AddIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
          )}
          {canDelete && (
            <Tooltip title="Rename">
              <IconButton size="small" onClick={() => onRename(folder.id)} sx={{ p: 0.25 }}>
                <EditOutlinedIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
          )}
          {canDelete && (
            <Tooltip title="Delete">
              <IconButton size="small" onClick={() => onDelete(folder.id)} sx={{ p: 0.25, color: 'error.main' }}>
                <DeleteOutlineIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </ListItemButton>
      {isExpanded && children}
    </Box>
  );
}

// Build a tree helper
function buildChildMap(folders: DocFolder[]): Map<string | null, DocFolder[]> {
  const map = new Map<string | null, DocFolder[]>();
  for (const f of folders) {
    const key = f.parent_id ?? null;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(f);
  }
  // Sort by position within each group
  for (const [, children] of map) {
    children.sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
  }
  return map;
}

export default function FolderTree({
  folders,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveFolder,
  onReorderFolders,
  docCountByFolder = {},
}: FolderTreeProps) {
  const { can } = useAuth();
  const canWrite = can('write');
  const canDelete = can('write'); // Admin/SDET — delete/rename gated by RLS anyway

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [newFolderParent, setNewFolderParent] = useState<string | null | undefined>(undefined);
  const [newFolderName, setNewFolderName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    await onCreateFolder(newFolderName.trim(), newFolderParent ?? null);
    setNewFolderName('');
    setNewFolderParent(undefined);
    if (newFolderParent) setExpanded((prev) => new Set(prev).add(newFolderParent));
  };

  const handleRenameConfirm = async () => {
    if (!renamingId || !renameValue.trim()) return;
    await onRenameFolder(renamingId, renameValue.trim());
    setRenamingId(null);
    setRenameValue('');
  };

  const handleDeleteConfirm = async () => {
    if (!deleteId) return;
    await onDeleteFolder(deleteId);
    setDeleteId(null);
  };

  // Drag-and-drop: only handles siblings at same parent level
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeFolder = folders.find((f) => f.id === active.id);
    const overFolder = folders.find((f) => f.id === over.id);
    if (!activeFolder || !overFolder) return;

    // Only reorder within same parent
    if (activeFolder.parent_id !== overFolder.parent_id) return;

    const siblings = folders
      .filter((f) => f.parent_id === activeFolder.parent_id)
      .sort((a, b) => a.position - b.position);

    const activeIdx = siblings.findIndex((f) => f.id === active.id);
    const overIdx = siblings.findIndex((f) => f.id === over.id);
    if (activeIdx === -1 || overIdx === -1) return;

    // Reorder array
    const reordered = [...siblings];
    const [moved] = reordered.splice(activeIdx, 1);
    reordered.splice(overIdx, 0, moved);

    // Calculate new position using gap algorithm
    const prevPos = overIdx > 0 ? reordered[overIdx - 1]?.position ?? 0 : 0;
    const nextPos = reordered[overIdx + 1]?.position;
    let newPosition: number;

    if (nextPos === undefined) {
      newPosition = prevPos + 1000;
    } else {
      newPosition = Math.floor((prevPos + nextPos) / 2);
    }

    const gap = nextPos !== undefined ? nextPos - newPosition : 1000;

    if (gap < 10) {
      // Re-number all siblings
      await onReorderFolders(reordered);
    } else {
      await onMoveFolder(activeFolder.id, activeFolder.parent_id, newPosition);
    }
  }, [folders, onMoveFolder, onReorderFolders]);

  const childMap = buildChildMap(folders);

  const renderFolder = (folder: DocFolder, depth: number): React.ReactNode => {
    const children = childMap.get(folder.id) ?? [];
    const hasChildren = children.length > 0;
    const isExpanded = expanded.has(folder.id);
    const isSelected = selectedFolderId === folder.id;

    return (
      <SortableFolderItem
        key={folder.id}
        folder={folder}
        depth={depth}
        isSelected={isSelected}
        isExpanded={isExpanded}
        hasChildren={hasChildren}
        canWrite={canWrite}
        canDelete={canDelete}
        onSelect={() => onSelectFolder(folder.id)}
        onToggle={() => toggleExpanded(folder.id)}
        onRename={(id) => {
          setRenamingId(id);
          setRenameValue(folders.find((f) => f.id === id)?.name ?? '');
        }}
        onDelete={(id) => setDeleteId(id)}
        onAddChild={(parentId) => {
          setNewFolderParent(parentId);
          setNewFolderName('');
        }}
      >
        <List disablePadding>
          <SortableContext items={children.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            {children.map((child) => renderFolder(child, depth + 1))}
          </SortableContext>
        </List>
      </SortableFolderItem>
    );
  };

  const rootFolders = childMap.get(null) ?? [];

  return (
    <Box>
      {/* All Docs */}
      <ListItemButton
        selected={selectedFolderId === null}
        onClick={() => onSelectFolder(null)}
        sx={{ pl: 1.5, py: 0.5, borderRadius: '6px', mb: 0.5 }}
      >
        <ListItemIcon sx={{ minWidth: 28 }}>
          <FolderOpenOutlinedIcon sx={{ fontSize: 18, color: selectedFolderId === null ? 'primary.main' : 'text.secondary' }} />
        </ListItemIcon>
        <ListItemText
          primary="All Docs"
          primaryTypographyProps={{ fontSize: '0.8125rem', fontWeight: selectedFolderId === null ? 600 : 400 }}
        />
      </ListItemButton>

      {/* Folder header + add root folder */}
      <Box sx={{ display: 'flex', alignItems: 'center', px: 1.5, pt: 1, pb: 0.5 }}>
        <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.secondary', flex: 1 }}>
          Folders
        </Typography>
        {canWrite && (
          <Tooltip title="New root folder">
            <IconButton size="small" onClick={() => { setNewFolderParent(null); setNewFolderName(''); }} sx={{ p: 0.25 }}>
              <AddIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* Folder tree with DnD */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={rootFolders.map((f) => f.id)} strategy={verticalListSortingStrategy}>
          <List disablePadding>
            {rootFolders.map((folder) => renderFolder(folder, 0))}
          </List>
        </SortableContext>
      </DndContext>

      {/* New folder inline input */}
      {newFolderParent !== undefined && (
        <Box sx={{ px: 1.5, pt: 1 }}>
          <TextField
            size="small"
            fullWidth
            autoFocus
            placeholder="Folder name"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateFolder();
              if (e.key === 'Escape') setNewFolderParent(undefined);
            }}
            onBlur={() => {
              if (newFolderName.trim()) handleCreateFolder();
              else setNewFolderParent(undefined);
            }}
            inputProps={{ style: { fontSize: '0.8125rem' } }}
          />
        </Box>
      )}

      {/* Rename dialog */}
      <Dialog open={!!renamingId} onClose={() => setRenamingId(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Rename Folder</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            size="small"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleRenameConfirm(); }}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenamingId(null)}>Cancel</Button>
          <Button variant="contained" onClick={handleRenameConfirm}>Rename</Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Folder</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {deleteId && docCountByFolder[deleteId]
              ? `This folder contains ${docCountByFolder[deleteId]} document(s). Deleting it will permanently remove all documents.`
              : 'Are you sure you want to delete this folder? This action cannot be undone.'}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDeleteConfirm}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
