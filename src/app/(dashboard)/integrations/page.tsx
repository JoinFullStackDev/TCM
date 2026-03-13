'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SendIcon from '@mui/icons-material/Send';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import { alpha } from '@mui/material/styles';
import PageTransition from '@/components/animations/PageTransition';
import WebhookEventLog from '@/components/webhooks/WebhookEventLog';
import { useAuth } from '@/components/providers/AuthProvider';
import { palette } from '@/theme/palette';
import type { Project, Suite, Integration, SlackConfig, GitLabCIConfig } from '@/types/database';

const DEFAULT_SLACK_CONFIG: SlackConfig = {
  webhook_url: '',
  channel: '',
  failure_threshold: 5,
  mention_usergroups: [],
  notify_on: 'all',
};

export default function IntegrationsPage() {
  const router = useRouter();
  const { can, isLoading: authLoading } = useAuth();
  const [events, setEvents] = useState<Parameters<typeof WebhookEventLog>[0]['events']>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [suites, setSuites] = useState<Suite[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [integrationsLoading, setIntegrationsLoading] = useState(false);

  const [showAddForm, setShowAddForm] = useState(false);
  const [formConfig, setFormConfig] = useState<SlackConfig>({ ...DEFAULT_SLACK_CONFIG });
  const [formSuiteId, setFormSuiteId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const DEFAULT_GITLAB_CONFIG: GitLabCIConfig = { trigger_token: '', trigger_url: '' };
  const [showGitLabForm, setShowGitLabForm] = useState(false);
  const [gitlabFormConfig, setGitlabFormConfig] = useState<GitLabCIConfig>({ ...DEFAULT_GITLAB_CONFIG });
  const [savingGitlab, setSavingGitlab] = useState(false);

  const canView = can('view_webhooks');
  const canManage = can('manage_integrations');

  useEffect(() => {
    if (!authLoading && !canView) {
      router.push('/');
    }
  }, [authLoading, canView, router]);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch('/api/webhooks/events');
      if (res.ok) setEvents(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProjects = useCallback(async () => {
    const res = await fetch('/api/projects');
    if (res.ok) {
      const data = await res.json();
      setProjects(data.filter((p: Project) => !p.is_archived));
    }
  }, []);

  const fetchSuites = useCallback(async (projectId: string) => {
    if (!projectId) { setSuites([]); return; }
    const res = await fetch(`/api/projects/${projectId}/suites`);
    if (res.ok) setSuites(await res.json());
  }, []);

  const fetchIntegrations = useCallback(async (projectId: string) => {
    if (!projectId) { setIntegrations([]); return; }
    setIntegrationsLoading(true);
    try {
      const res = await fetch(`/api/integrations?project_id=${projectId}`);
      if (res.ok) setIntegrations(await res.json());
    } finally {
      setIntegrationsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && canView) {
      fetchEvents();
      if (canManage) fetchProjects();
    }
  }, [authLoading, canView, canManage, fetchEvents, fetchProjects]);

  useEffect(() => {
    if (selectedProjectId) {
      fetchIntegrations(selectedProjectId);
      fetchSuites(selectedProjectId);
    } else {
      setIntegrations([]);
      setSuites([]);
    }
  }, [selectedProjectId, fetchIntegrations, fetchSuites]);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const showMessage = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleTestSlack = async (webhookUrl?: string) => {
    const url = webhookUrl ?? formConfig.webhook_url;
    if (!url) return;
    setTesting(true);
    try {
      const res = await fetch('/api/integrations/test-slack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhook_url: url }),
      });
      if (res.ok) {
        showMessage('Test message sent to Slack!', 'success');
      } else {
        const data = await res.json();
        showMessage(data.error || 'Failed to send test message', 'error');
      }
    } catch {
      showMessage('Failed to reach server', 'error');
    } finally {
      setTesting(false);
    }
  };

  const handleSaveIntegration = async () => {
    if (!formConfig.webhook_url || !selectedProjectId) return;
    setSaving(true);
    try {
      const res = await fetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: selectedProjectId,
          suite_id: formSuiteId || null,
          type: 'slack',
          config: formConfig,
        }),
      });
      if (res.ok) {
        showMessage('Slack integration saved', 'success');
        setShowAddForm(false);
        setFormConfig({ ...DEFAULT_SLACK_CONFIG });
        setFormSuiteId('');
        fetchIntegrations(selectedProjectId);
      } else {
        const data = await res.json();
        showMessage(data.error || 'Failed to save integration', 'error');
      }
    } catch {
      showMessage('Failed to reach server', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (integration: Integration) => {
    const res = await fetch(`/api/integrations/${integration.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !integration.is_active }),
    });
    if (res.ok) {
      fetchIntegrations(selectedProjectId);
      showMessage(
        `Integration ${integration.is_active ? 'disabled' : 'enabled'}`,
        'success',
      );
    }
  };

  const handleDeleteIntegration = async (id: string) => {
    const res = await fetch(`/api/integrations/${id}`, { method: 'DELETE' });
    if (res.ok) {
      fetchIntegrations(selectedProjectId);
      showMessage('Integration deleted', 'success');
    }
  };

  if (authLoading || !canView) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  const handleSaveGitLabIntegration = async () => {
    if (!gitlabFormConfig.trigger_token || !gitlabFormConfig.trigger_url || !selectedProjectId) return;
    setSavingGitlab(true);
    try {
      const res = await fetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: selectedProjectId,
          suite_id: null,
          type: 'gitlab',
          config: gitlabFormConfig,
        }),
      });
      if (res.ok) {
        showMessage('GitLab CI integration saved', 'success');
        setShowGitLabForm(false);
        setGitlabFormConfig({ ...DEFAULT_GITLAB_CONFIG });
        fetchIntegrations(selectedProjectId);
      } else {
        const data = await res.json();
        showMessage(data.error || 'Failed to save integration', 'error');
      }
    } catch {
      showMessage('Failed to reach server', 'error');
    } finally {
      setSavingGitlab(false);
    }
  };

  const webhookUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/webhooks/playwright`
      : '/api/webhooks/playwright';

  const slackIntegrations = integrations.filter((i) => i.type === 'slack');
  const gitlabIntegrations = integrations.filter((i) => i.type === 'gitlab');

  return (
    <PageTransition>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          Integrations
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 4 }}>
          Configure webhook endpoints and notification channels for your projects.
        </Typography>

        {/* ─── Playwright Webhook Section ─── */}
        <Box
          sx={{
            p: 3,
            mb: 3,
            borderRadius: 2,
            bgcolor: 'background.paper',
            border: `1px solid ${palette.divider}`,
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
            Playwright Webhook
          </Typography>

          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
              Endpoint URL
            </Typography>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                p: 1.5,
                borderRadius: 1,
                bgcolor: palette.background.surface2,
                border: `1px solid ${palette.divider}`,
              }}
            >
              <Typography
                variant="body2"
                sx={{ fontFamily: 'monospace', fontSize: '0.8rem', flex: 1 }}
              >
                {webhookUrl}
              </Typography>
              <Tooltip title={copied === 'url' ? 'Copied!' : 'Copy'}>
                <IconButton size="small" onClick={() => handleCopy(webhookUrl, 'url')}>
                  <ContentCopyIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {canManage && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
                API Key (X-API-Key header)
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  p: 1.5,
                  borderRadius: 1,
                  bgcolor: palette.background.surface2,
                  border: `1px solid ${palette.divider}`,
                }}
              >
                <Typography
                  variant="body2"
                  sx={{ fontFamily: 'monospace', fontSize: '0.8rem', flex: 1 }}
                >
                  ••••••••••••••••••••
                </Typography>
                <Tooltip title={copied === 'key' ? 'Copied!' : 'Copy key'}>
                  <IconButton
                    size="small"
                    onClick={() => handleCopy('tcm-webhook-dev-key-change-in-production', 'key')}
                  >
                    <ContentCopyIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              </Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>
                Include this key in the X-API-Key header of your CI/CD webhook requests.
              </Typography>
            </Box>
          )}

          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Method:{' '}
              <Chip
                label="POST"
                size="small"
                sx={{ height: 20, fontSize: '0.6rem', fontWeight: 600, ml: 0.5 }}
              />
            </Typography>
          </Box>
        </Box>

        {/* ─── Slack Integration Section ─── */}
        {canManage && (
          <Box
            sx={{
              p: 3,
              mb: 3,
              borderRadius: 2,
              bgcolor: 'background.paper',
              border: `1px solid ${palette.divider}`,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Slack Notifications
              </Typography>
              <Chip
                label="S4"
                size="small"
                sx={{
                  height: 20,
                  fontSize: '0.6rem',
                  fontWeight: 700,
                  bgcolor: alpha(palette.success.main, 0.15),
                  color: palette.success.main,
                }}
              />
            </Box>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
              Send test run completion summaries and failure alerts to Slack channels.
            </Typography>

            {/* Project Selector */}
            <FormControl fullWidth size="small" sx={{ mb: 3 }}>
              <InputLabel>Select Project</InputLabel>
              <Select
                value={selectedProjectId}
                label="Select Project"
                onChange={(e) => setSelectedProjectId(e.target.value)}
              >
                {projects.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {selectedProjectId && (
              <>
                {integrationsLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                    <CircularProgress size={24} />
                  </Box>
                ) : (
                  <>
                    {/* Existing Integrations */}
                    {slackIntegrations.map((integration) => {
                      const cfg = integration.config as SlackConfig;
                      const suiteName = integration.suite_id
                        ? suites.find((s) => s.id === integration.suite_id)?.name
                        : null;

                      return (
                        <Box
                          key={integration.id}
                          sx={{
                            p: 2,
                            mb: 2,
                            borderRadius: 1.5,
                            bgcolor: palette.background.surface2,
                            border: `1px solid ${palette.divider}`,
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }}>
                              {cfg.channel ? `#${cfg.channel}` : 'Slack Webhook'}
                            </Typography>
                            {suiteName && (
                              <Chip
                                label={suiteName}
                                size="small"
                                sx={{
                                  height: 20,
                                  fontSize: '0.6rem',
                                  bgcolor: alpha(palette.info.main, 0.15),
                                  color: palette.info.main,
                                }}
                              />
                            )}
                            {!suiteName && integration.suite_id === null && (
                              <Chip
                                label="All Suites"
                                size="small"
                                sx={{
                                  height: 20,
                                  fontSize: '0.6rem',
                                  bgcolor: alpha(palette.primary.main, 0.15),
                                  color: palette.primary.main,
                                }}
                              />
                            )}
                            <Chip
                              label={cfg.notify_on === 'failures_only' ? 'Failures Only' : 'All Runs'}
                              size="small"
                              sx={{
                                height: 20,
                                fontSize: '0.6rem',
                                bgcolor: alpha(
                                  cfg.notify_on === 'failures_only'
                                    ? palette.warning.main
                                    : palette.success.main,
                                  0.15,
                                ),
                                color:
                                  cfg.notify_on === 'failures_only'
                                    ? palette.warning.main
                                    : palette.success.main,
                              }}
                            />
                          </Box>

                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography
                              variant="caption"
                              sx={{
                                fontFamily: 'monospace',
                                fontSize: '0.7rem',
                                color: 'text.secondary',
                                flex: 1,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {cfg.webhook_url.replace(/(services\/T[^/]+\/B[^/]+\/).+/, '$1••••••')}
                            </Typography>

                            {cfg.failure_threshold > 0 && (
                              <Chip
                                label={`Alert at ${cfg.failure_threshold}+ failures`}
                                size="small"
                                sx={{
                                  height: 18,
                                  fontSize: '0.55rem',
                                  bgcolor: alpha(palette.error.main, 0.12),
                                  color: palette.error.main,
                                }}
                              />
                            )}
                          </Box>

                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5 }}>
                            <FormControlLabel
                              control={
                                <Switch
                                  size="small"
                                  checked={integration.is_active}
                                  onChange={() => handleToggleActive(integration)}
                                />
                              }
                              label={
                                <Typography variant="caption">
                                  {integration.is_active ? 'Active' : 'Disabled'}
                                </Typography>
                              }
                            />
                            <Box sx={{ flex: 1 }} />
                            <Tooltip title="Send test message">
                              <IconButton
                                size="small"
                                onClick={() => handleTestSlack(cfg.webhook_url)}
                                disabled={testing}
                              >
                                <SendIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete integration">
                              <IconButton
                                size="small"
                                onClick={() => handleDeleteIntegration(integration.id)}
                                sx={{ color: palette.error.main }}
                              >
                                <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </Box>
                      );
                    })}

                    {slackIntegrations.length === 0 && !showAddForm && (
                      <Typography
                        variant="body2"
                        sx={{ color: 'text.disabled', textAlign: 'center', py: 2 }}
                      >
                        No Slack integrations configured for this project.
                      </Typography>
                    )}

                    {/* Add New Form */}
                    {showAddForm ? (
                      <Box
                        sx={{
                          p: 2.5,
                          borderRadius: 1.5,
                          bgcolor: palette.background.surface2,
                          border: `1px solid ${palette.divider}`,
                          mt: 2,
                        }}
                      >
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
                          New Slack Integration
                        </Typography>

                        <TextField
                          fullWidth
                          size="small"
                          label="Webhook URL"
                          placeholder="https://hooks.slack.com/services/..."
                          value={formConfig.webhook_url}
                          onChange={(e) =>
                            setFormConfig((c) => ({ ...c, webhook_url: e.target.value }))
                          }
                          sx={{ mb: 2 }}
                        />

                        <TextField
                          fullWidth
                          size="small"
                          label="Channel Name (for display)"
                          placeholder="e.g. qa-results"
                          value={formConfig.channel}
                          onChange={(e) =>
                            setFormConfig((c) => ({ ...c, channel: e.target.value }))
                          }
                          sx={{ mb: 2 }}
                        />

                        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                          <InputLabel>Suite Scope</InputLabel>
                          <Select
                            value={formSuiteId}
                            label="Suite Scope"
                            onChange={(e) => setFormSuiteId(e.target.value)}
                          >
                            <MenuItem value="">All Suites (project-wide)</MenuItem>
                            {suites.map((s) => (
                              <MenuItem key={s.id} value={s.id}>
                                {s.name} ({s.prefix})
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>

                        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                          <InputLabel>Notify On</InputLabel>
                          <Select
                            value={formConfig.notify_on}
                            label="Notify On"
                            onChange={(e) =>
                              setFormConfig((c) => ({
                                ...c,
                                notify_on: e.target.value as 'all' | 'failures_only',
                              }))
                            }
                          >
                            <MenuItem value="all">All completed runs</MenuItem>
                            <MenuItem value="failures_only">Only runs with failures</MenuItem>
                          </Select>
                        </FormControl>

                        <TextField
                          fullWidth
                          size="small"
                          type="number"
                          label="Failure Threshold for Alert"
                          helperText="Send an additional alert when failures reach this number (0 to disable)"
                          value={formConfig.failure_threshold}
                          onChange={(e) =>
                            setFormConfig((c) => ({
                              ...c,
                              failure_threshold: Math.max(0, parseInt(e.target.value) || 0),
                            }))
                          }
                          sx={{ mb: 3 }}
                        />

                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                          <Button
                            size="small"
                            variant="outlined"
                            color="inherit"
                            onClick={() => handleTestSlack()}
                            disabled={!formConfig.webhook_url || testing}
                            startIcon={testing ? <CircularProgress size={14} /> : <SendIcon />}
                          >
                            Test
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="inherit"
                            onClick={() => {
                              setShowAddForm(false);
                              setFormConfig({ ...DEFAULT_SLACK_CONFIG });
                              setFormSuiteId('');
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="small"
                            variant="contained"
                            onClick={handleSaveIntegration}
                            disabled={!formConfig.webhook_url || saving}
                            startIcon={saving ? <CircularProgress size={14} /> : undefined}
                          >
                            Save
                          </Button>
                        </Box>
                      </Box>
                    ) : (
                      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<AddIcon />}
                          onClick={() => setShowAddForm(true)}
                        >
                          Add Slack Integration
                        </Button>
                      </Box>
                    )}
                  </>
                )}
              </>
            )}
          </Box>
        )}

        {/* ─── GitLab CI Section ─── */}
        {canManage && (
          <Box
            sx={{
              p: 3,
              mb: 3,
              borderRadius: 2,
              bgcolor: 'background.paper',
              border: `1px solid ${palette.divider}`,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                GitLab CI
              </Typography>
              <Chip
                label="S2"
                size="small"
                sx={{
                  height: 20,
                  fontSize: '0.6rem',
                  fontWeight: 700,
                  bgcolor: alpha(palette.info.main, 0.15),
                  color: palette.info.main,
                }}
              />
            </Box>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
              Configure a GitLab CI pipeline trigger to run automated Playwright tests directly from TCM.
            </Typography>

            {/* Project Selector (shared with Slack section) */}
            {!selectedProjectId && (
              <FormControl fullWidth size="small" sx={{ mb: 3 }}>
                <InputLabel>Select Project</InputLabel>
                <Select
                  value={selectedProjectId}
                  label="Select Project"
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                >
                  {projects.map((p) => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {selectedProjectId && (
              <>
                {integrationsLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                    <CircularProgress size={24} />
                  </Box>
                ) : (
                  <>
                    {gitlabIntegrations.map((integration) => {
                      const cfg = integration.config as GitLabCIConfig;
                      return (
                        <Box
                          key={integration.id}
                          sx={{
                            p: 2,
                            mb: 2,
                            borderRadius: 1.5,
                            bgcolor: palette.background.surface2,
                            border: `1px solid ${palette.divider}`,
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }}>
                              GitLab Pipeline Trigger
                            </Typography>
                            <Chip
                              label={integration.is_active ? 'Active' : 'Disabled'}
                              size="small"
                              sx={{
                                height: 20,
                                fontSize: '0.6rem',
                                bgcolor: alpha(
                                  integration.is_active ? palette.success.main : palette.neutral.main,
                                  0.15,
                                ),
                                color: integration.is_active ? palette.success.main : 'text.secondary',
                              }}
                            />
                          </Box>
                          <Typography
                            variant="caption"
                            sx={{
                              fontFamily: 'monospace',
                              fontSize: '0.7rem',
                              color: 'text.secondary',
                              display: 'block',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              mb: 1.5,
                            }}
                          >
                            {cfg.trigger_url}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Switch
                              size="small"
                              checked={integration.is_active}
                              onChange={() => handleToggleActive(integration)}
                            />
                            <Typography variant="caption">
                              {integration.is_active ? 'Active' : 'Disabled'}
                            </Typography>
                            <Box sx={{ flex: 1 }} />
                            <Tooltip title="Delete integration">
                              <IconButton
                                size="small"
                                onClick={() => handleDeleteIntegration(integration.id)}
                                sx={{ color: palette.error.main }}
                              >
                                <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </Box>
                      );
                    })}

                    {gitlabIntegrations.length === 0 && !showGitLabForm && (
                      <Typography
                        variant="body2"
                        sx={{ color: 'text.disabled', textAlign: 'center', py: 2 }}
                      >
                        No GitLab CI integration configured for this project.
                      </Typography>
                    )}

                    {showGitLabForm ? (
                      <Box
                        sx={{
                          p: 2.5,
                          borderRadius: 1.5,
                          bgcolor: palette.background.surface2,
                          border: `1px solid ${palette.divider}`,
                          mt: 2,
                        }}
                      >
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
                          New GitLab CI Integration
                        </Typography>

                        <TextField
                          fullWidth
                          size="small"
                          type="password"
                          label="Trigger Token"
                          placeholder="glptt-xxxx"
                          value={gitlabFormConfig.trigger_token}
                          onChange={(e) =>
                            setGitlabFormConfig((c) => ({ ...c, trigger_token: e.target.value }))
                          }
                          sx={{ mb: 2 }}
                        />

                        <TextField
                          fullWidth
                          size="small"
                          label="Trigger URL"
                          placeholder="https://gitlab.com/api/v4/projects/123/trigger/pipeline"
                          value={gitlabFormConfig.trigger_url}
                          onChange={(e) =>
                            setGitlabFormConfig((c) => ({ ...c, trigger_url: e.target.value }))
                          }
                          sx={{ mb: 3 }}
                        />

                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                          <Button
                            size="small"
                            variant="outlined"
                            color="inherit"
                            onClick={() => {
                              setShowGitLabForm(false);
                              setGitlabFormConfig({ ...DEFAULT_GITLAB_CONFIG });
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="small"
                            variant="contained"
                            onClick={handleSaveGitLabIntegration}
                            disabled={
                              !gitlabFormConfig.trigger_token ||
                              !gitlabFormConfig.trigger_url ||
                              savingGitlab
                            }
                            startIcon={savingGitlab ? <CircularProgress size={14} /> : undefined}
                          >
                            Save
                          </Button>
                        </Box>
                      </Box>
                    ) : (
                      gitlabIntegrations.length === 0 && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<AddIcon />}
                            onClick={() => setShowGitLabForm(true)}
                          >
                            Add GitLab CI Integration
                          </Button>
                        </Box>
                      )
                    )}
                  </>
                )}
              </>
            )}
          </Box>
        )}

        {/* ─── Webhook Event Log ─── */}
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
          Webhook Event Log
        </Typography>

        <WebhookEventLog events={events} loading={loading} />

        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            onClick={fetchEvents}
            sx={{ fontSize: '0.75rem' }}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </PageTransition>
  );
}
