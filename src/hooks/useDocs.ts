'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { DocFolder, DocSummary, Doc } from '@/types/database';

export type SaveStatus = 'saved' | 'saving' | 'error' | null;

export interface UseDocsReturn {
  folders: DocFolder[];
  docs: DocSummary[];
  selectedFolderId: string | null;
  selectedDocId: string | null;
  selectedDoc: Doc | null;
  projectFilter: string | null;
  isSaving: boolean;
  saveStatus: SaveStatus;
  // Actions
  selectFolder: (folderId: string | null) => void;
  selectDoc: (docId: string | null) => void;
  setProjectFilter: (projectId: string | null) => void;
  createFolder: (name: string, parentId?: string | null, projectId?: string | null) => Promise<DocFolder | null>;
  renameFolder: (id: string, name: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  moveFolder: (id: string, parentId: string | null, position: number) => Promise<void>;
  reorderFolders: (siblings: DocFolder[]) => Promise<void>;
  createDoc: (folderId?: string | null) => Promise<Doc | null>;
  deleteDoc: (id: string) => Promise<void>;
  moveDoc: (docId: string, folderId: string | null) => Promise<void>;
  saveDocContent: (content: string) => void;
  saveDocTitle: (title: string) => Promise<void>;
  refreshFolders: () => Promise<void>;
  refreshDocs: (folderId?: string | null) => Promise<void>;
}

const AUTOSAVE_DELAY = 1500;

export function useDocs(initialDocId?: string | null): UseDocsReturn {
  const [folders, setFolders] = useState<DocFolder[]>([]);
  const [docs, setDocs] = useState<DocSummary[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(initialDocId ?? null);
  const [selectedDoc, setSelectedDoc] = useState<Doc | null>(null);
  const [projectFilter, setProjectFilter] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(null);

  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingContent = useRef<string | null>(null);

  // ─── Fetch helpers ─────────────────────────────────────────────────────────

  const refreshFolders = useCallback(async () => {
    try {
      const res = await fetch('/api/docs/folders');
      if (!res.ok) return;
      const { folders: data } = await res.json();
      setFolders(data);
    } catch {
      // silent
    }
  }, []);

  const refreshDocs = useCallback(async (folderId?: string | null) => {
    try {
      const url = folderId ? `/api/docs?folderId=${folderId}` : '/api/docs';
      const res = await fetch(url);
      if (!res.ok) return;
      const { docs: data } = await res.json();
      setDocs(data);
    } catch {
      // silent
    }
  }, []);

  const loadDoc = useCallback(async (docId: string) => {
    try {
      const res = await fetch(`/api/docs/${docId}`);
      if (!res.ok) {
        setSelectedDoc(null);
        return;
      }
      const { doc } = await res.json();
      setSelectedDoc(doc);
    } catch {
      setSelectedDoc(null);
    }
  }, []);

  // ─── Bootstrap ─────────────────────────────────────────────────────────────

  useEffect(() => {
    refreshFolders();
    refreshDocs(null);
  }, [refreshFolders, refreshDocs]);

  // Deep-link: if initialDocId provided, load doc on mount
  useEffect(() => {
    if (initialDocId) {
      loadDoc(initialDocId);
    }
  }, [initialDocId, loadDoc]);

  // ─── Selection ─────────────────────────────────────────────────────────────

  const selectFolder = useCallback((folderId: string | null) => {
    setSelectedFolderId(folderId);
    refreshDocs(folderId);
  }, [refreshDocs]);

  const selectDoc = useCallback((docId: string | null) => {
    setSelectedDocId(docId);
    if (docId) {
      loadDoc(docId);
    } else {
      setSelectedDoc(null);
    }
  }, [loadDoc]);

  // ─── Folder actions ────────────────────────────────────────────────────────

  const createFolder = useCallback(async (
    name: string,
    parentId?: string | null,
    projectId?: string | null,
  ): Promise<DocFolder | null> => {
    try {
      const res = await fetch('/api/docs/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, parent_id: parentId ?? null, project_id: projectId ?? null }),
      });
      if (!res.ok) return null;
      const { folder } = await res.json();
      setFolders((prev) => [...prev, folder]);
      return folder;
    } catch {
      return null;
    }
  }, []);

  const renameFolder = useCallback(async (id: string, name: string) => {
    const res = await fetch(`/api/docs/folders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return;
    const { folder } = await res.json();
    setFolders((prev) => prev.map((f) => (f.id === id ? folder : f)));
  }, []);

  const deleteFolder = useCallback(async (id: string) => {
    const res = await fetch(`/api/docs/folders/${id}`, { method: 'DELETE' });
    if (!res.ok) return;
    // Remove folder and all descendants from local state
    setFolders((prev) => {
      const toRemove = new Set<string>();
      const findDescendants = (fid: string) => {
        toRemove.add(fid);
        prev.filter((f) => f.parent_id === fid).forEach((f) => findDescendants(f.id));
      };
      findDescendants(id);
      return prev.filter((f) => !toRemove.has(f.id));
    });
    // If selected folder was deleted, reset
    if (selectedFolderId === id) {
      setSelectedFolderId(null);
      refreshDocs(null);
    }
  }, [selectedFolderId, refreshDocs]);

  const moveFolder = useCallback(async (
    id: string,
    parentId: string | null,
    position: number,
  ) => {
    // Optimistic update
    setFolders((prev) =>
      prev.map((f) => (f.id === id ? { ...f, parent_id: parentId, position } : f)),
    );
    try {
      const res = await fetch(`/api/docs/folders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parent_id: parentId, position }),
      });
      if (!res.ok) {
        // Revert on error
        await refreshFolders();
      }
    } catch {
      await refreshFolders();
    }
  }, [refreshFolders]);

  const reorderFolders = useCallback(async (siblings: DocFolder[]) => {
    // Batch renumber: set positions 0, 1000, 2000...
    const updates = siblings.map((f, i) => ({ ...f, position: i * 1000 }));
    setFolders((prev) => {
      const updateMap = new Map(updates.map((f) => [f.id, f]));
      return prev.map((f) => updateMap.get(f.id) ?? f);
    });
    await Promise.all(
      updates.map((f) =>
        fetch(`/api/docs/folders/${f.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ position: f.position }),
        }),
      ),
    );
  }, []);

  // ─── Doc actions ───────────────────────────────────────────────────────────

  const createDoc = useCallback(async (folderId?: string | null): Promise<Doc | null> => {
    try {
      const res = await fetch('/api/docs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder_id: folderId ?? selectedFolderId ?? null }),
      });
      if (!res.ok) return null;
      const { doc } = await res.json();
      setDocs((prev) => [doc, ...prev]);
      setSelectedDocId(doc.id);
      setSelectedDoc(doc);
      return doc;
    } catch {
      return null;
    }
  }, [selectedFolderId]);

  const deleteDoc = useCallback(async (id: string) => {
    const res = await fetch(`/api/docs/${id}`, { method: 'DELETE' });
    if (!res.ok) return;
    setDocs((prev) => prev.filter((d) => d.id !== id));
    if (selectedDocId === id) {
      setSelectedDocId(null);
      setSelectedDoc(null);
    }
  }, [selectedDocId]);

  const moveDoc = useCallback(async (docId: string, folderId: string | null) => {
    // Optimistic update
    setDocs((prev) => prev.filter((d) => d.id !== docId));
    try {
      const res = await fetch(`/api/docs/${docId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder_id: folderId }),
      });
      if (!res.ok) {
        // Revert
        await refreshDocs(selectedFolderId);
      } else {
        const { doc } = await res.json();
        if (selectedDoc?.id === docId) {
          setSelectedDoc(doc);
        }
      }
    } catch {
      await refreshDocs(selectedFolderId);
    }
  }, [selectedFolderId, selectedDoc, refreshDocs]);

  // ─── Autosave ──────────────────────────────────────────────────────────────

  const flushSave = useCallback(async () => {
    if (!selectedDocId || pendingContent.current === null) return;
    const content = pendingContent.current;
    pendingContent.current = null;
    setIsSaving(true);
    setSaveStatus('saving');
    try {
      const res = await fetch(`/api/docs/${selectedDocId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        setSaveStatus('error');
        return;
      }
      const { doc } = await res.json();
      setSelectedDoc(doc);
      setDocs((prev) => prev.map((d) => (d.id === doc.id ? { ...d, updated_at: doc.updated_at } : d)));
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  }, [selectedDocId]);

  const saveDocContent = useCallback((content: string) => {
    pendingContent.current = content;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      flushSave();
    }, AUTOSAVE_DELAY);
  }, [flushSave]);

  const saveDocTitle = useCallback(async (title: string) => {
    if (!selectedDocId) return;
    try {
      const res = await fetch(`/api/docs/${selectedDocId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) return;
      const { doc } = await res.json();
      setSelectedDoc(doc);
      setDocs((prev) => prev.map((d) => (d.id === doc.id ? { ...d, title: doc.title } : d)));
    } catch {
      // silent
    }
  }, [selectedDocId]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, []);

  return {
    folders,
    docs,
    selectedFolderId,
    selectedDocId,
    selectedDoc,
    projectFilter,
    isSaving,
    saveStatus,
    selectFolder,
    selectDoc,
    setProjectFilter,
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
    refreshFolders,
    refreshDocs,
  };
}
