'use client';

import { useEffect, useRef, useState } from 'react';
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
import {
  isValidApiBase,
  UNREACHABLE_ENVIRONMENTS,
  type EnvironmentInfo,
  type SimEnvironment,
} from '@/lib/partner-sim/environments';
import { readError, type SimPartner } from './types';

interface Props {
  open: boolean;
  environments: EnvironmentInfo[];
  /** Present when editing. */
  partner?: SimPartner | null;
  /** Editing only: open straight on the API key, for swapping it. */
  swapKey?: boolean;
  onClose: () => void;
  onSaved: (partner: SimPartner) => void;
}

const RESPONSE_STATUSES = [200, 202, 204, 400, 404, 410, 429, 500, 503];

export default function PartnerFormDialog({ open, environments, partner, swapKey, onClose, onSaved }: Props) {
  const editing = !!partner;
  const [name, setName] = useState('');
  const [environment, setEnvironment] = useState<SimEnvironment>('staging');
  const [apiBaseUrl, setApiBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [secret, setSecret] = useState('');
  const [removeSecret, setRemoveSecret] = useState(false);
  const [responseStatus, setResponseStatus] = useState(200);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const keyRef = useRef<HTMLInputElement>(null);

  const envDefault = (id: SimEnvironment) => environments.find((e) => e.id === id)?.defaultApiUrl ?? '';

  useEffect(() => {
    if (!open) return;
    const env = partner?.environment ?? 'staging';
    setName(partner?.name ?? '');
    setEnvironment(env);
    setApiBaseUrl(partner?.api_base_url ?? partner?.api_url ?? envDefault(env));
    setApiKey('');
    setSecret('');
    setRemoveSecret(false);
    setResponseStatus(partner?.webhook_response_status ?? 200);
    setError(null);
    if (swapKey) setTimeout(() => keyRef.current?.focus(), 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, partner, swapKey]);

  const changeEnvironment = (next: SimEnvironment) => {
    // Follow the environment's default URL unless QA already typed something else.
    if (!apiBaseUrl || apiBaseUrl === envDefault(environment)) setApiBaseUrl(envDefault(next));
    setEnvironment(next);
  };

  const urlOk = isValidApiBase(apiBaseUrl);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const body: Record<string, unknown> = {
      name,
      environment,
      api_base_url: apiBaseUrl,
      webhook_response_status: responseStatus,
    };
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
      onSaved((await res.json()) as SimPartner);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{editing ? (swapKey ? `Swap the key for ${partner!.name}` : `Edit ${partner!.name}`) : 'New test partner'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {swapKey && (
            <Alert severity="info">
              In FullStackRx, open the connection&apos;s <strong>Keys</strong> tab, issue a new key, and revoke the old one.
              Paste the new key below. (Sending one order with the old key afterwards is a good check: it should get 401
              key_revoked.)
            </Alert>
          )}
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Acme Telehealth (QA)"
            size="small"
            required
            autoFocus={!swapKey}
          />
          <TextField
            select
            label="FullStackRx environment"
            value={environment}
            onChange={(e) => changeEnvironment(e.target.value as SimEnvironment)}
            size="small"
          >
            {environments.map((e) => (
              <MenuItem key={e.id} value={e.id}>
                {e.label}
              </MenuItem>
            ))}
          </TextField>
          {UNREACHABLE_ENVIRONMENTS[environment] && (
            <Alert severity="warning">{UNREACHABLE_ENVIRONMENTS[environment]}</Alert>
          )}
          <TextField
            label="API base URL"
            value={apiBaseUrl}
            onChange={(e) => setApiBaseUrl(e.target.value)}
            placeholder="https://demo.fullstackrx.com"
            size="small"
            required
            error={!!apiBaseUrl && !urlOk}
            helperText="The FullStackRx host for this environment (staging: https://demo.fullstackrx.com). The simulator calls <host>/api/partner/v1/…"
          />
          <TextField
            inputRef={keyRef}
            label={editing ? `API key (current: …${partner!.api_key_last4}; leave blank to keep)` : 'API key'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="fsrx_test_… or fsrx_live_…"
            size="small"
            autoComplete="off"
            required={!editing || swapKey}
            helperText="FullStackRx: Settings → Partner connections → the connection → Keys. Test keys run every check but create nothing; on QA/staging use a live key on a test pharmacy."
          />
          {!swapKey && (
            <>
              <TextField
                label={
                  editing && partner!.webhook_secret_last4
                    ? `Webhook signing secret (current: …${partner!.webhook_secret_last4}; leave blank to keep)`
                    : 'Webhook signing secret (optional)'
                }
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="whsec_…"
                size="small"
                autoComplete="off"
                disabled={removeSecret}
                helperText="Shown on the connection's Webhooks tab. Used to check FullStackRx-Signature on received webhooks."
              />
              {editing && partner!.webhook_secret_last4 && (
                <FormControlLabel
                  control={<Checkbox checked={removeSecret} onChange={(e) => setRemoveSecret(e.target.checked)} />}
                  label="Remove the saved webhook secret"
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
            </>
          )}
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
          disabled={saving || !name.trim() || !urlOk || ((!editing || swapKey) && !apiKey.trim())}
        >
          {saving ? 'Saving…' : swapKey ? 'Save new key' : editing ? 'Save' : 'Create partner'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
