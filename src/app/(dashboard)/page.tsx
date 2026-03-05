'use client';

import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import CircularProgress from '@mui/material/CircularProgress';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import UnarchiveOutlinedIcon from '@mui/icons-material/UnarchiveOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import PageTransition from '@/components/animations/PageTransition';
import ProjectCard from '@/components/projects/ProjectCard';
import CreateProjectDialog from '@/components/projects/CreateProjectDialog';
import EditProjectDialog from '@/components/projects/EditProjectDialog';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import EmptyState from '@/components/common/EmptyState';
import { useAuth } from '@/components/providers/AuthProvider';
import type { Project } from '@/types/database';

interface ProjectWithCounts extends Project {
  suite_count: number;
  test_case_count: number;
}

export default function DashboardPage() {
  const { can, isLoading: authLoading } = useAuth();
  const [projects, setProjects] = useState<ProjectWithCounts[]>([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [menuProjectId, setMenuProjectId] = useState<string | null>(null);

  const canWrite = can('write');
  const canDelete = can('delete_project');

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading) fetchProjects();
  }, [authLoading, fetchProjects]);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, id: string) => {
    setMenuAnchor(event.currentTarget);
    setMenuProjectId(id);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setMenuProjectId(null);
  };

  const handleEdit = () => {
    const proj = projects.find((p) => p.id === menuProjectId);
    if (proj) {
      setEditProject(proj);
      setEditOpen(true);
    }
    handleMenuClose();
  };

  const handleArchiveToggle = async () => {
    const proj = projects.find((p) => p.id === menuProjectId);
    if (!proj) return;
    handleMenuClose();

    await fetch(`/api/projects/${proj.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_archived: !proj.is_archived }),
    });
    fetchProjects();
  };

  const handleDeleteConfirm = async () => {
    if (!deleteId) return;
    setDeleteLoading(true);
    await fetch(`/api/projects/${deleteId}`, { method: 'DELETE' });
    setDeleteLoading(false);
    setDeleteOpen(false);
    setDeleteId(null);
    fetchProjects();
  };

  if (authLoading || loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <PageTransition>
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Projects
          </Typography>
          {canWrite && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setCreateOpen(true)}
            >
              New Project
            </Button>
          )}
        </Box>

        {projects.length === 0 ? (
          <EmptyState
            icon={<FolderOutlinedIcon sx={{ fontSize: 32 }} />}
            title="No projects yet"
            description="Create your first project to start organizing test cases into suites."
            actionLabel="New Project"
            onAction={() => setCreateOpen(true)}
            showAction={canWrite}
          />
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                md: 'repeat(2, 1fr)',
                lg: 'repeat(3, 1fr)',
              },
              gap: 2,
            }}
          >
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                id={project.id}
                name={project.name}
                description={project.description}
                suiteCount={project.suite_count}
                testCaseCount={project.test_case_count}
                isArchived={project.is_archived}
                onMenuOpen={handleMenuOpen}
                showMenu={canWrite}
              />
            ))}
          </Box>
        )}

        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={handleMenuClose}
        >
          <MenuItem onClick={handleEdit}>
            <ListItemIcon><EditOutlinedIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Edit</ListItemText>
          </MenuItem>
          <MenuItem onClick={handleArchiveToggle}>
            <ListItemIcon>
              {projects.find((p) => p.id === menuProjectId)?.is_archived
                ? <UnarchiveOutlinedIcon fontSize="small" />
                : <ArchiveOutlinedIcon fontSize="small" />
              }
            </ListItemIcon>
            <ListItemText>
              {projects.find((p) => p.id === menuProjectId)?.is_archived ? 'Unarchive' : 'Archive'}
            </ListItemText>
          </MenuItem>
          {canDelete && (
            <MenuItem
              onClick={() => {
                setDeleteId(menuProjectId);
                setDeleteOpen(true);
                handleMenuClose();
              }}
              sx={{ color: 'error.main' }}
            >
              <ListItemIcon><DeleteOutlineIcon fontSize="small" sx={{ color: 'error.main' }} /></ListItemIcon>
              <ListItemText>Delete</ListItemText>
            </MenuItem>
          )}
        </Menu>

        <CreateProjectDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreated={fetchProjects}
        />

        <EditProjectDialog
          open={editOpen}
          project={editProject}
          onClose={() => setEditOpen(false)}
          onUpdated={fetchProjects}
        />

        <ConfirmDialog
          open={deleteOpen}
          title="Delete Project"
          message="This will permanently delete the project and all its suites, test cases, and related data. This action cannot be undone."
          confirmLabel="Delete"
          destructive
          loading={deleteLoading}
          onConfirm={handleDeleteConfirm}
          onCancel={() => { setDeleteOpen(false); setDeleteId(null); }}
        />
      </Box>
    </PageTransition>
  );
}
