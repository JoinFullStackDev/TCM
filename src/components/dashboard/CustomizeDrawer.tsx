'use client';

import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import Typography from '@mui/material/Typography';
import Switch from '@mui/material/Switch';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import {
  CARD_DEFINITIONS,
  getDefaultConfig,
  type CardSection,
} from './cardRegistry';
import { palette } from '@/theme/palette';
import type { DashboardCardConfig } from '@/types/database';

const SECTION_LABELS: Record<CardSection, string> = {
  user: 'Your Overview',
  global: 'Platform',
  admin: 'Administration',
};

interface CustomizeDrawerProps {
  open: boolean;
  onClose: () => void;
  preferences: DashboardCardConfig[] | null;
  onSaved: (config: DashboardCardConfig[]) => void;
}

export default function CustomizeDrawer({
  open,
  onClose,
  preferences,
  onSaved,
}: CustomizeDrawerProps) {
  const [config, setConfig] = useState<DashboardCardConfig[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (preferences && preferences.length > 0) {
        const existing = new Map(preferences.map((p) => [p.card_id, p]));
        const merged = CARD_DEFINITIONS.map((def) => {
          const pref = existing.get(def.id);
          return {
            card_id: def.id,
            visible: pref ? pref.visible : def.defaultVisible,
            position: pref ? pref.position : def.defaultPosition,
          };
        });
        setConfig(merged);
      } else {
        setConfig(getDefaultConfig());
      }
    }
  }, [open, preferences]);

  const toggleVisibility = useCallback((cardId: string) => {
    setConfig((prev) =>
      prev.map((c) => (c.card_id === cardId ? { ...c, visible: !c.visible } : c)),
    );
  }, []);

  const moveCard = useCallback((cardId: string, direction: 'up' | 'down') => {
    setConfig((prev) => {
      const card = CARD_DEFINITIONS.find((d) => d.id === cardId);
      if (!card) return prev;
      const section = card.section;
      const sectionCards = prev
        .filter((c) => CARD_DEFINITIONS.find((d) => d.id === c.card_id)?.section === section)
        .sort((a, b) => a.position - b.position);

      const idx = sectionCards.findIndex((c) => c.card_id === cardId);
      if (idx < 0) return prev;
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= sectionCards.length) return prev;

      const currentPos = sectionCards[idx].position;
      const swapPos = sectionCards[swapIdx].position;

      return prev.map((c) => {
        if (c.card_id === cardId) return { ...c, position: swapPos };
        if (c.card_id === sectionCards[swapIdx].card_id) return { ...c, position: currentPos };
        return c;
      });
    });
  }, []);

  const handleReset = useCallback(() => {
    setConfig(getDefaultConfig());
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/dashboard/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ card_config: config }),
      });
      if (res.ok) {
        onSaved(config);
        onClose();
      }
    } finally {
      setSaving(false);
    }
  }, [config, onSaved, onClose]);

  const sections: CardSection[] = ['user', 'global', 'admin'];

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: 360,
          bgcolor: 'background.paper',
          p: 3,
        },
      }}
    >
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
        Customize Dashboard
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
        Toggle cards on or off and reorder them within each section.
      </Typography>

      {sections.map((section) => {
        const sectionDefs = CARD_DEFINITIONS.filter((d) => d.section === section);
        const sectionConfigs = config
          .filter((c) => sectionDefs.some((d) => d.id === c.card_id))
          .sort((a, b) => a.position - b.position);

        if (sectionConfigs.length === 0) return null;

        return (
          <Box key={section} sx={{ mb: 3 }}>
            <Typography
              variant="overline"
              sx={{
                color: 'text.secondary',
                fontWeight: 700,
                letterSpacing: '0.08em',
                mb: 1,
                display: 'block',
              }}
            >
              {SECTION_LABELS[section]}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {sectionConfigs.map((cardConfig, i) => {
                const def = CARD_DEFINITIONS.find((d) => d.id === cardConfig.card_id);
                if (!def) return null;
                return (
                  <Box
                    key={cardConfig.card_id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      py: 0.5,
                      px: 1,
                      borderRadius: 1,
                      bgcolor: 'background.default',
                    }}
                  >
                    <Switch
                      size="small"
                      checked={cardConfig.visible}
                      onChange={() => toggleVisibility(cardConfig.card_id)}
                    />
                    <Typography variant="body2" sx={{ flex: 1, fontSize: '0.8rem' }}>
                      {def.title}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => moveCard(cardConfig.card_id, 'up')}
                      disabled={i === 0}
                      sx={{ p: 0.25 }}
                    >
                      <KeyboardArrowUpIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => moveCard(cardConfig.card_id, 'down')}
                      disabled={i === sectionConfigs.length - 1}
                      sx={{ p: 0.25 }}
                    >
                      <KeyboardArrowDownIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Box>
                );
              })}
            </Box>
          </Box>
        );
      })}

      <Divider sx={{ my: 2 }} />

      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button
          variant="outlined"
          size="small"
          startIcon={<RestartAltIcon />}
          onClick={handleReset}
          sx={{ flex: 1 }}
        >
          Reset
        </Button>
        <Button
          variant="contained"
          size="small"
          onClick={handleSave}
          disabled={saving}
          sx={{ flex: 1 }}
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </Box>
    </Drawer>
  );
}
