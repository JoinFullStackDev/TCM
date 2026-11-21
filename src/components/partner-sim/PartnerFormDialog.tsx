'use client';

import { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import type { EnvironmentInfo } from '@/lib/partner-sim/environments';
import { readError, type SimPartner } from './types';

interface Props {
  open: boolean;
  environments: EnvironmentInfo[];
  /** Present when editing. */
  partner?: SimPartner | null;
  onClose: () => void;
  onSaved: (partner: SimPartner) => void;
}

const RESPONSE_STATUSES = [200, 202, 204, 400, 404, 410, 429, 500, 503];

export default function PartnerFormDialog({ open, environments, partner, onClose, onSaved }: Props) {
  const editing = !!partner;
  const [name, setName] = useState('');
  const [environment, setEnvironment] = useState('qa');
  const [apiKey, setApiKey] = useState('');
  const [secret, setSecret] = useState('');
  const [removeSecret, setRemoveSecret] = useState(false);
  const [responseStatus, setResponseStatus] = useState(200);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(partner?.name ?? '');
    setEnvironment(partner?.environment ?? environments.find((e) => e.apiUrl)?.id ?? 'qa');
    setApiKey('');
    setSecret('');
    setRemoveSecret(false);
    setResponseStatus(partner?.webhook_response_status ?? 200);
    setError(null);
  }, [open, partner, environments]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const body: Record<string, unknown> = { name, environment, webhook_response_status: responseStatus };
    if (apiKey.trim()) body.api_key = apiKey.trim();
    if (removeSecret) body.webhook_secret = null;
    else if (secret.trim()) body.webhook_secret = secret.trim();

    try {
      const res = await fetch(editing ? `/api/partner-sim/partners/${partner!.id}` : '/api/partner-sim/partners', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError(await readError(res));
        return;
      }
      onSaved(await res.json());
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const env = environments.find((e) => e.id === environment);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{editing ? `Edit ${partner!.name}` : 'New test partner'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Acme Telehealth (QA)"
            size="small"
            required
            autoFocus
          />
          <TextField
            select
            label="FullStackRx environment"
            value={environment}
            onChange={(e) => setEnvironment(e.target.value)}
            size="small"
            helperText={
              env?.apiUrl
                ? `Calls ${env.apiUrl}/v1`
                : `No API URL configured for ${env?.label ?? environment}: set PARTNER_SIM_${environment.toUpperCase()}_API_URL`
            }
            error={!!env && !env.apiUrl}
          >
            {environments.map((e) => (
              <MenuItem key={e.id} value={e.id}>
                {e.label}
                {e.apiUrl ? '' : ' (not configured)'}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label={editing ? `API key (stored: …${partner!.api_key_last4}; leave blank to keep)` : 'API key'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="fsrx_test_… or fsrx_live_…"
            size="small"
            type="password"
            autoComplete="off"
            required={!editing}
            helperText="From FullStackRx: Settings → Partner connections → the connection → Keys. Test keys run every check but create nothing; on QA/staging use a live key on a test pharmacy."
          />
          <TextField
            label={
              editing && partner!.webhook_secret_last4
                ? `Webhook signing secret (stored: …${partner!.webhook_secret_last4}; leave blank to keep)`
                : 'Webhook signing secret (optional)'
            }
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="whsec_…"
            size="small"
            type="password"
            autoComplete="off"
            disabled={removeSecret}
            helperText="Shown once on the connection's Webhooks tab. Used to verify FullStackRx-Signature on received events."
          />
          {editing && partner!.webhook_secret_last4 && (
            <FormControlLabel
              control={<Checkbox checked={removeSecret} onChange={(e) => setRemoveSecret(e.target.checked)} />}
              label="Remove the stored webhook secret"
            />
          )}
          <TextField
            select
            label="Webhook receiver answers with"
            value={responseStatus}
            onChange={(e) => setResponseStatus(Number(e.target.value))}
            size="small"
            helperText="Keep 200 normally. Pick a 4xx/5xx to watch FullStackRx retry and mark deliveries failed."
          >
            {RESPONSE_STATUSES.map((s) => (
              <MenuItem key={s} value={s}>
                {s}
              </MenuItem>
            ))}
          </TextField>
          <Alert severity="info" variant="outlined">
            Keys and secrets are encrypted at rest and only used server-side. After saving, TCM only shows their last 4
            characters.
          </Alert>
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving || !name.trim() || (!editing && !apiKey.trim())}
        >
          {saving ? 'Saving…' : editing ? 'Save' : 'Create partner'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
