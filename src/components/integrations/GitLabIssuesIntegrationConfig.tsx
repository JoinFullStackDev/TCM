'use client';

import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

interface Props {
  projectId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

interface FieldErrors {
  gitlab_url?: string;
  project_id?: string;
  private_token?: string;
  general?: string;
}

export default function GitLabIssuesIntegrationConfig({ projectId, onSuccess, onCancel }: Props) {
  const [gitlabUrl, setGitlabUrl] = useState('https://gitlab.com');
  const [gitlabProjectId, setGitlabProjectId] = useState('');
  const [privateToken, setPrivateToken] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSaving, setIsSaving] = useState(false);

  function validate(): boolean {
    const newErrors: FieldErrors = {};
    try { new URL(gitlabUrl); } catch { newErrors.gitlab_url = 'Must be a valid URL'; }
    if (!gitlabProjectId.trim()) newErrors.project_id = 'GitLab project ID is required';
    if (!privateToken.trim()) newErrors.private_token = 'Private token is required';
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
          type: 'gitlab_issues',
          project_id: projectId,
          config: {
            gitlab_url: gitlabUrl.trim().replace(/\/$/, ''),
            project_id: gitlabProjectId.trim(),
            private_token: privateToken,
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
        GitLab Issues Integration
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Export feedback as GitLab Issues. This is separate from the GitLab CI trigger integration.
      </Typography>

      <Alert severity="info" sx={{ mb: 2 }}>
        This requires an <strong>api</strong> scope personal access token. It is separate from any GitLab CI trigger credentials.
      </Alert>

      <Stack spacing={2}>
        <TextField
          fullWidth
          label="GitLab URL"
          placeholder="https://gitlab.com"
          value={gitlabUrl}
          onChange={(e) => setGitlabUrl(e.target.value)}
          error={!!errors.gitlab_url}
          helperText={errors.gitlab_url ?? 'For self-hosted: https://gitlab.yourcompany.com'}
          disabled={isSaving}
          size="small"
        />

        <TextField
          fullWidth
          label="GitLab Project ID or Path"
          placeholder="123456 or namespace/project"
          value={gitlabProjectId}
          onChange={(e) => setGitlabProjectId(e.target.value)}
          error={!!errors.project_id}
          helperText={errors.project_id ?? 'Numeric project ID or URL-encoded namespace/project path'}
          disabled={isSaving}
          size="small"
        />

        <TextField
          fullWidth
          label="Private Token"
          type="password"
          placeholder="Enter your GitLab personal access token"
          value={privateToken}
          onChange={(e) => setPrivateToken(e.target.value)}
          error={!!errors.private_token}
          helperText={errors.private_token ?? 'Requires api scope'}
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
