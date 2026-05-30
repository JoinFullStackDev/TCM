'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';

export type AgentStatus = 'active' | 'idle' | 'offline' | 'degraded';

export interface Agent {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  capabilities: string[] | null;
  avatar_url: string | null;
  accent_color: string;
  status: AgentStatus;
  openclaw_id: string | null;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_CONFIG: Record<AgentStatus, { label: string; color: string; pulse: boolean }> = {
  active: { label: 'Active', color: '#14B8A6', pulse: true },
  idle: { label: 'Idle', color: '#F59E0B', pulse: false },
  offline: { label: 'Offline', color: '#475569', pulse: false },
  degraded: { label: 'Degraded', color: '#F43F5E', pulse: true },
};

interface Props {
  agent: Agent;
  onClick: (agent: Agent) => void;
}

export default function AgentCard({ agent, onClick }: Props) {
  const statusCfg = STATUS_CONFIG[agent.status];
  const avatarSrc = agent.avatar_url ?? `/agents/${agent.name}.png`;

  return (
    <Card
      elevation={0}
      sx={{
        bgcolor: '#0F172A',
        border: `1px solid ${agent.accent_color}33`,
        borderRadius: 2,
        overflow: 'hidden',
        transition: 'border-color 0.2s, transform 0.15s',
        '&:hover': {
          borderColor: agent.accent_color + '77',
          transform: 'translateY(-2px)',
        },
      }}
    >
      <CardActionArea onClick={() => onClick(agent)} sx={{ p: 0 }}>
        {/* Hero area */}
        <Box
          sx={{
            height: 160,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            bgcolor: agent.accent_color + '18',
            borderBottom: `1px solid ${agent.accent_color}22`,
            overflow: 'hidden',
          }}
        >
          {/* Background glow */}
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              background: `radial-gradient(ellipse at center, ${agent.accent_color}15 0%, transparent 70%)`,
              pointerEvents: 'none',
            }}
          />

          {/* Avatar with fallback */}
          <AgentAvatar
            src={avatarSrc}
            accentColor={agent.accent_color}
            displayName={agent.display_name}
          />

          {/* Status indicator */}
          <Box
            sx={{
              position: 'absolute',
              top: 10,
              right: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
            }}
          >
            <FiberManualRecordIcon
              sx={{
                fontSize: 10,
                color: statusCfg.color,
                animation: statusCfg.pulse ? 'pulse 1.5s ease-in-out infinite' : 'none',
                '@keyframes pulse': {
                  '0%, 100%': { opacity: 1 },
                  '50%': { opacity: 0.3 },
                },
              }}
            />
            <Typography variant="caption" sx={{ color: statusCfg.color, fontWeight: 600, fontSize: '0.65rem' }}>
              {statusCfg.label.toUpperCase()}
            </Typography>
          </Box>
        </Box>

        {/* Card body */}
        <Box sx={{ p: 2 }}>
          <Typography variant="subtitle1" sx={{ color: '#f1f5f9', fontWeight: 700, mb: 0.5 }}>
            {agent.display_name}
          </Typography>
          {agent.description && (
            <Typography
              variant="caption"
              sx={{
                color: '#64748b',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                lineHeight: 1.5,
                mb: 1.5,
              }}
            >
              {agent.description}
            </Typography>
          )}

          {/* Capabilities */}
          {agent.capabilities && agent.capabilities.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {agent.capabilities.slice(0, 4).map((cap) => (
                <Chip
                  key={cap}
                  label={cap}
                  size="small"
                  sx={{
                    bgcolor: agent.accent_color + '18',
                    color: agent.accent_color,
                    border: `1px solid ${agent.accent_color}33`,
                    fontSize: '0.6rem',
                    height: 18,
                  }}
                />
              ))}
              {agent.capabilities.length > 4 && (
                <Chip
                  label={`+${agent.capabilities.length - 4}`}
                  size="small"
                  sx={{ bgcolor: '#ffffff11', color: '#64748b', fontSize: '0.6rem', height: 18 }}
                />
              )}
            </Box>
          )}
        </Box>
      </CardActionArea>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// AgentAvatar — renders image with letter fallback
// ---------------------------------------------------------------------------
function AgentAvatar({ src, accentColor, displayName }: { src: string; accentColor: string; displayName: string }) {
  const [imgError, setImgError] = useState(false);

  if (imgError) {
    return (
      <Box
        sx={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          bgcolor: accentColor,
          border: `3px solid ${accentColor}88`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: 32, lineHeight: 1 }}>
          {displayName.charAt(0).toUpperCase()}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      component="img"
      src={src}
      alt={displayName}
      onError={() => setImgError(true)}
      sx={{
        width: 80,
        height: 80,
        objectFit: 'cover',
        borderRadius: '50%',
        border: `3px solid ${accentColor}44`,
        position: 'relative',
        zIndex: 1,
      }}
    />
  );
}
