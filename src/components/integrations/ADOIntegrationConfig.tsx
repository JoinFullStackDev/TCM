'use client';

import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

interface Props {
  projectId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

interface FieldErrors {
  organization_url?: string;
  project_name?: string;
  pat_token?: string;
  general?: string;
}

export default function ADOIntegrationConfig({ projectId, onSuccess, onCancel }: Props) {
  const [organizationUrl, setOrganizationUrl] = useState('');
  const [projectName, setProjectName] = useState('');
  const [patToken, setPatToken] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSaving, setIsSaving] = useState(false);

  function validate(): boolean {
    const newErrors: FieldErrors = {};
    try { new URL(organizationUrl); } catch { newErrors.organization_url = 'Must be a valid URL'; }
    if (!projectName.trim()) newErrors.project_name = 'Project name is required';
    if (!patToken.trim()) newErrors.pat_token = 'PAT token is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setIsSaving(true);
    setErrors({});

    try {
      const res = await fetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'ado',
          project_id: projectId,
          config: {
            organization_url: organizationUrl.trim(),
            project_name: projectName.trim(),
            pat_token: patToken,
          },
          is_active: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrors({ general: data?.error ?? 'Failed to save integration' });
        return;
      }

      onSuccess?.();
    } catch {
      setErrors({ general: 'Network error. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Box>
      <Typography variant="subtitle2" fontWeight={600} gutterBottom>
        Azure DevOps Integration
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Connect to Azure DevOps to export feedback as Bugs or User Stories.
      </Typography>

      <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ mb: 2 }}>
        <strong>PAT token security:</strong> Your token will be stored encrypted. You cannot retrieve it after saving — store a copy elsewhere.
      </Alert>

      <Stack spacing={2}>
        <TextField
          fullWidth
          label="Organization URL"
          placeholder="https://dev.azure.com/yourorg"
          value={organizationUrl}
          onChange={(e) => setOrganizationUrl(e.target.value)}
          error={!!errors.organization_url}
          helperText={errors.organization_url}
          disabled={isSaving}
          size="small"
        />

        <TextField
          fullWidth
          label="Project Name"
          placeholder="MyProject"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          error={!!errors.project_name}
          helperText={errors.project_name}
          disabled={isSaving}
          size="small"
        />

        <TextField
          fullWidth
          label="Personal Access Token"
          type="password"
          placeholder="Enter your ADO PAT"
          value={patToken}
          onChange={(e) => setPatToken(e.target.value)}
          error={!!errors.pat_token}
          helperText={errors.pat_token ?? 'Requires Work Items (Read & Write) scope'}
          disabled={isSaving}
          size="small"
        />

        {errors.general && <Alert severity="error">{errors.general}</Alert>}

        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={isSaving}
            startIcon={isSaving ? <CircularProgress size={14} color="inherit" /> : null}
          >
            {isSaving ? 'Saving…' : 'Save Integration'}
          </Button>
          {onCancel && (
            <Button variant="outlined" onClick={onCancel} disabled={isSaving}>
              Cancel
            </Button>
          )}
        </Box>
      </Stack>
    </Box>
  );
}
