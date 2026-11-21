'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import CasinoOutlinedIcon from '@mui/icons-material/CasinoOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { randomPrescriber } from '@/lib/partner-sim/randomizer';
import { isValidNpi } from '@/lib/partner-sim/npi';
import { ALL_STATES } from '@/lib/partner-sim/fake-data';
import { formatTime, readError, type SimPartner, type SimPrescriber } from './types';

const EMPTY = { npi: '', first_name: '', last_name: '', license_state: 'UT', license_number: '', note: '' };

interface Props {
  partner: SimPartner;
  prescribers: SimPrescriber[];
  onChanged: () => void;
}

export default function PrescribersPanel({ partner, prescribers, onChanged }: Props) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const randomFill = () => {
    const state = partner.connection?.allowedStates?.[0] ?? partner.catalog?.allowedStates?.[0] ?? 'UT';
    const p = randomPrescriber(Math.random, state);
    setForm({
      npi: p.npi,
      first_name: p.firstName,
      last_name: p.lastName,
      license_state: p.stateLicense.state,
      license_number: p.stateLicense.number,
      note: '',
    });
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/partner-sim/partners/${partner.id}/prescribers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, note: form.note || null }),
      });
      if (!res.ok) {
        setError(await readError(res));
        return;
      }
      setForm(EMPTY);
      onChanged();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    const res = await fetch(`/api/partner-sim/partners/${partner.id}/prescribers/${id}`, { method: 'DELETE' });
    if (res.ok) onChanged();
  };

  const npiOk = isValidNpi(form.npi);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Alert severity="info" variant="outlined">
        A brand-new prescriber&apos;s first order intentionally waits in the pharmacy&apos;s Partner Inbox for a licence
        review. Once the pharmacy approves it, reuse that prescriber (the Happy path preset picks the most recently used
        one) and orders go straight through. Every prescriber on an order FullStackRx accepted is saved here
        automatically.
      </Alert>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1 }}>
            Add a prescriber
          </Typography>
          <Button size="small" startIcon={<CasinoOutlinedIcon />} onClick={randomFill}>
            Random
          </Button>
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 1.5 }}>
          <TextField
            size="small"
            label="NPI"
            value={form.npi}
            onChange={(e) => setForm({ ...form, npi: e.target.value.trim() })}
            error={!!form.npi && !npiOk}
            helperText={form.npi ? (npiOk ? 'Check digit valid' : 'Check digit invalid') : 'A real NPPES NPI works best'}
          />
          <TextField size="small" label="First name" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
          <TextField size="small" label="Last name" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
          <TextField select size="small" label="Licence state" value={form.license_state} onChange={(e) => setForm({ ...form, license_state: e.target.value })}>
            {ALL_STATES.map((s) => (
              <MenuItem key={s} value={s}>
                {s}
              </MenuItem>
            ))}
          </TextField>
          <TextField size="small" label="Licence number" value={form.license_number} onChange={(e) => setForm({ ...form, license_number: e.target.value })} />
          <TextField size="small" label="Note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="e.g. approved in QA inbox" />
        </Box>
        {error && (
          <Alert severity="error" sx={{ mt: 1.5 }}>
            {error}
          </Alert>
        )}
        <Button
          variant="contained"
          sx={{ mt: 1.5 }}
          onClick={save}
          disabled={saving || !/^\d{10}$/.test(form.npi) || !form.first_name || !form.last_name || !form.license_number}
        >
          Save prescriber
        </Button>
      </Paper>

      <Paper variant="outlined">
        <Typography variant="subtitle2" sx={{ fontWeight: 700, p: 1.5 }}>
          Saved prescribers ({prescribers.length})
        </Typography>
        {prescribers.length > 0 && (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>NPI</TableCell>
                <TableCell>Licence</TableCell>
                <TableCell>Last used</TableCell>
                <TableCell>Note</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {prescribers.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    {p.first_name} {p.last_name}
                  </TableCell>
                  <TableCell sx={{ fontFamily: 'monospace' }}>{p.npi}</TableCell>
                  <TableCell>
                    {p.license_state} {p.license_number}
                  </TableCell>
                  <TableCell>{formatTime(p.last_used_at)}</TableCell>
                  <TableCell>{p.note ?? ''}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" aria-label="Delete prescriber" onClick={() => remove(p.id)}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>
    </Box>
  );
}
