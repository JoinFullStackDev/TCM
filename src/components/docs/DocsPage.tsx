'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import FolderTree from './FolderTree';
import DocList from './DocList';
import DocEditor from './DocEditor';
import MoveDocModal from './MoveDocModal';
import type { UseDocsReturn } from '@/hooks/useDocs';

interface DocsPageProps {
  hook: UseDocsReturn;
}

export default function DocsPage({ hook }: DocsPageProps) {
  const {
    folders,
    docs,
    selectedFolderId,
    selectedDocId,
    selectedDoc,
    saveStatus,
    selectFolder,
    selectDoc,
    createFolder,
    renameFolder,
    deleteFolder,
    moveFolder,
    reorderFolders,
    createDoc,
    deleteDoc,
    moveDoc,
    saveDocContent,
    saveDocTitle,
  } = hook;

  const [moveModalDocId, setMoveModalDocId] = useState<string | null>(null);

  // Build doc count per folder for delete warnings
  const docCountByFolder: Record<string, number> = {};
  for (const doc of docs) {
    if (doc.folder_id) {
      docCountByFolder[doc.folder_id] = (docCountByFolder[doc.folder_id] ?? 0) + 1;
    }
  }

  return (
    <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Column 1: Folder tree (240px) */}
      <Box
        sx={{
          width: 240,
          minWidth: 240,
          borderRight: '1px solid',
          borderColor: 'divider',
          overflow: 'auto',
          p: 1,
          flexShrink: 0,
        }}
      >
        <FolderTree
          folders={folders}
          selectedFolderId={selectedFolderId}
          onSelectFolder={selectFolder}
          onCreateFolder={createFolder}
          onRenameFolder={renameFolder}
          onDeleteFolder={deleteFolder}
          onMoveFolder={moveFolder}
          onReorderFolders={reorderFolders}
          docCountByFolder={docCountByFolder}
        />
      </Box>

      {/* Column 2: Doc list (280px) */}
      <Box
        sx={{
          width: 280,
          minWidth: 280,
          borderRight: '1px solid',
          borderColor: 'divider',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
        }}
      >
        <DocList
          docs={docs}
          selectedDocId={selectedDocId}
          selectedFolderId={selectedFolderId}
          onSelectDoc={selectDoc}
          onCreateDoc={createDoc}
          onDeleteDoc={deleteDoc}
          onOpenMoveModal={(docId) => setMoveModalDocId(docId)}
        />
      </Box>

      {/* Column 3: Doc editor (flex) */}
      <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {selectedDoc ? (
          <DocEditor
            doc={selectedDoc}
            saveStatus={saveStatus}
            onContentChange={saveDocContent}
            onTitleChange={saveDocTitle}
          />
        ) : (
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Select a document to start editing
            </Typography>
          </Box>
        )}
      </Box>

      {/* Move doc modal */}
      {moveModalDocId && (
        <MoveDocModal
          open
          folders={folders}
          currentFolderId={docs.find((d) => d.id === moveModalDocId)?.folder_id ?? null}
          onClose={() => setMoveModalDocId(null)}
          onMove={(folderId) => {
            void moveDoc(moveModalDocId, folderId);
          }}
        />
      )}
    </Box>
  );
}
