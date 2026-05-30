'use client';

import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import RefreshIcon from '@mui/icons-material/Refresh';
import GridViewOutlinedIcon from '@mui/icons-material/GridViewOutlined';
import PageTransition from '@/components/animations/PageTransition';
import { palette } from '@/theme/palette';
import { useAuth } from '@/components/providers/AuthProvider';
import AgentCard, { type Agent } from './AgentCard';
import AgentDetailDrawer from './AgentDetailDrawer';

export default function RegistryPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  const fetchAgents = async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const res = await fetch('/api/agents');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Agent[] = await res.json();
      setAgents(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agents');
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const handleAgentUpdated = (updated: Agent) => {
    setAgents((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    setSelectedAgent(updated);
  };

  return (
    <PageTransition>
      <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
          <GridViewOutlinedIcon sx={{ color: palette.primary.main, fontSize: 28 }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#f1f5f9' }}>
              Agent Registry
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748b' }}>
              Registered FullThrottle agents and their capabilities
            </Typography>
          </Box>
          <Box sx={{ ml: 'auto' }}>
            <Tooltip title="Refresh">
              <IconButton onClick={() => fetchAgents(true)} size="small" sx={{ color: '#64748b' }}>
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress size={32} />
          </Box>
        ) : agents.length === 0 ? (
          <Box
            sx={{
              textAlign: 'center',
              py: 8,
              color: '#475569',
              border: '1px dashed #ffffff11',
              borderRadius: 2,
            }}
          >
            <GridViewOutlinedIcon sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
            <Typography variant="body2">No agents registered</Typography>
          </Box>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: 2.5,
            }}
          >
            {agents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onClick={setSelectedAgent}
              />
            ))}
          </Box>
        )}
      </Box>

      {/* Detail Drawer */}
      <AgentDetailDrawer
        agent={selectedAgent}
        isAdmin={isAdmin}
        onClose={() => setSelectedAgent(null)}
        onAgentUpdated={handleAgentUpdated}
      />
    </PageTransition>
  );
}
