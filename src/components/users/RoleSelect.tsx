'use client';

import { useState } from 'react';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Chip from '@mui/material/Chip';
import { alpha } from '@mui/material/styles';
import { semanticColors } from '@/theme/palette';
import { ROLE_LABELS, ALL_ROLES } from '@/lib/auth/rbac';
import type { UserRole } from '@/types/database';

interface RoleSelectProps {
  value: UserRole;
  userId: string;
  disabled?: boolean;
  onChanged: () => void;
}

export default function RoleSelect({ value, userId, disabled, onChanged }: RoleSelectProps) {
  const [role, setRole] = useState(value);
  const [saving, setSaving] = useState(false);

  const handleChange = async (newRole: string) => {
    const r = newRole as UserRole;
    if (r === role) return;
    setSaving(true);
    const prev = role;
    setRole(r);

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: r }),
      });
      if (!res.ok) {
        setRole(prev);
      } else {
        onChanged();
      }
    } catch {
      setRole(prev);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Select
      value={role}
      onChange={(e) => handleChange(e.target.value)}
      size="small"
      disabled={disabled || saving}
      sx={{ minWidth: 140, fontSize: '0.8125rem' }}
      renderValue={(val) => {
        const color = semanticColors.role[val as UserRole];
        return (
          <Chip
            label={ROLE_LABELS[val as UserRole]}
            size="small"
            sx={{
              height: 22,
              fontSize: '0.7rem',
              fontWeight: 600,
              bgcolor: alpha(color, 0.15),
              color,
            }}
          />
        );
      }}
    >
      {ALL_ROLES.map((r) => {
        const color = semanticColors.role[r];
        return (
          <MenuItem key={r} value={r}>
            <Chip
              label={ROLE_LABELS[r]}
              size="small"
              sx={{
                height: 22,
                fontSize: '0.7rem',
                fontWeight: 600,
                bgcolor: alpha(color, 0.15),
                color,
                mr: 1,
              }}
            />
          </MenuItem>
        );
      })}
    </Select>
  );
}
