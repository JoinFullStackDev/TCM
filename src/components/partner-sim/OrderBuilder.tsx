'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Alert from '@mui/material/Alert';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import RadioGroup from '@mui/material/RadioGroup';
import Radio from '@mui/material/Radio';
import Autocomplete from '@mui/material/Autocomplete';
import CircularProgress from '@mui/material/CircularProgress';
import CasinoOutlinedIcon from '@mui/icons-material/CasinoOutlined';
import SendIcon from '@mui/icons-material/Send';
import ReplayIcon from '@mui/icons-material/Replay';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { PRESETS, randomizeOrder, randomPrescriber, newPartnerOrderId } from '@/lib/partner-sim/randomizer';
import { isValidNpi } from '@/lib/partner-sim/npi';
import { ALL_STATES } from '@/lib/partner-sim/fake-data';
import type { OrderPreset } from '@/lib/partner-sim/types';
import CallResultView from './CallResultView';
import { HttpChip } from './StatusChip';
import { problemCode, type CallResult, type SimOrder, type SimPartner, type SimPrescriber } from './types';
import { submitOrder, type SubmitBody } from './api';

type Draft = Record<string, unknown>;
type Path = (string | number)[];

function getAt(obj: unknown, path: Path): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string | number, unknown>)[key];
  }
  return cur;
}

function setAt(obj: unknown, path: Path, value: unknown): Draft {
  const [key, ...rest] = path;
  const base = obj && typeof obj === 'object' ? obj : typeof key === 'number' ? [] : {};
  const copy = (Array.isArray(base) ? [...base] : { ...base }) as Record<string | number, unknown>;
  if (rest.length === 0) {
    if (value === undefined) delete copy[key];
    else copy[key] = value;
  } else {
    copy[key] = setAt(copy[key], rest, value);
  }
  return copy as Draft;
}

const grid = (cols: number) => ({
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: `repeat(${cols}, 1fr)` },
  gap: 1.5,
});

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, gap: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        {action}
      </Box>
      {children}
    </Paper>
  );
}

interface SubmitResult {
  order: SimOrder;
  call: CallResult;
}

interface Props {
  partner: SimPartner;
  prescribers: SimPrescriber[];
  orders: SimOrder[];
  onSubmitted: (order: SimOrder) => void;
  onOpenOrder: (orderId: string) => void;
}

export default function OrderBuilder({ partner, prescribers, orders, onSubmitted, onOpenOrder }: Props) {
  const [preset, setPreset] = useState<OrderPreset>('happy_path');
  const [draft, setDraft] = useState<Draft>({});
  const [expect, setExpect] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [mode, setMode] = useState<'form' | 'json'>('form');
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [keyMode, setKeyMode] = useState<'auto' | 'custom' | 'none'>('auto');
  const [customKey, setCustomKey] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);

  const catalogItems = useMemo(() => partner.catalog?.items ?? [], [partner.catalog]);
  const shippingMethods = partner.catalog?.shippingMethods ?? [];
  const acceptedIds = useMemo(
    () =>
      orders
        .filter((o) => o.response_status === 201 && o.partner_order_id)
        .map((o) => o.partner_order_id as string),
    [orders],
  );

  const randomize = useCallback(
    (p: OrderPreset) => {
      const r = randomizeOrder(p, {
        catalog: partner.catalog,
        connection: partner.connection,
        savedPrescribers: prescribers,
        previousPartnerOrderIds: acceptedIds,
      });
      setPreset(p);
      setDraft(r.order as unknown as Draft);
      setJsonText(JSON.stringify(r.order, null, 2));
      setJsonError(null);
      setExpect(r.expect);
      setWarnings(r.warnings);
      // The duplicate preset needs a fresh Idempotency-Key, or FullStackRx just replays the first answer.
      if (p === 'duplicate_order' && keyMode === 'custom') setKeyMode('auto');
    },
    [partner.catalog, partner.connection, prescribers, acceptedIds, keyMode],
  );

  // Fill a first order once the partner (and its prescribers) are loaded.
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (!seeded) {
      randomize('happy_path');
      setSeeded(true);
    }
  }, [seeded, randomize]);

  // The form edits `draft`; the JSON tab is re-serialized from it whenever it opens.
  const update = (path: Path, value: unknown) => setDraft((d) => setAt(d, path, value));

  const switchMode = (next: 'form' | 'json') => {
    if (next === 'json') {
      setJsonText(JSON.stringify(draft, null, 2));
      setJsonError(null);
      setMode('json');
      return;
    }
    try {
      const parsed = JSON.parse(jsonText);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('The order must be a JSON object');
      setDraft(parsed);
      setJsonError(null);
      setMode('form');
    } catch (e) {
      setJsonError((e as Error).message);
    }
  };

  const currentRequest = (): Draft | null => {
    if (mode === 'form') return draft;
    try {
      const parsed = JSON.parse(jsonText);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('The order must be a JSON object');
      setJsonError(null);
      return parsed;
    } catch (e) {
      setJsonError((e as Error).message);
      return null;
    }
  };

  const send = async (body: SubmitBody) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const r = await submitOrder(partner, body);
      if (!r.ok) {
        setSubmitError(r.error);
        return;
      }
      setResult(r.data);
      onSubmitted(r.data.order);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = () => {
    const request = currentRequest();
    if (!request) return;
    const body: SubmitBody = { request, preset };
    if (keyMode === 'none') body.send_idempotency_key = false;
    if (keyMode === 'custom') body.idempotency_key = customKey.trim();
    send(body);
  };

  const handleRetry = () => {
    if (!result) return;
    send({
      request: result.order.request_body,
      idempotency_key: result.order.idempotency_key || undefined,
      send_idempotency_key: !!result.order.idempotency_key,
      retry_of: result.order.retry_of ?? result.order.id,
      preset: result.order.preset ?? undefined,
    });
  };

  // ---- field helpers --------------------------------------------------------------
  const text = (label: string, path: Path, opts: { type?: string; placeholder?: string; helper?: React.ReactNode; error?: boolean } = {}) => {
    const value = getAt(draft, path);
    return (
      <TextField
        label={label}
        size="small"
        type={opts.type ?? 'text'}
        value={value === undefined || value === null ? '' : String(value)}
        placeholder={opts.placeholder}
        helperText={opts.helper}
        error={opts.error}
        slotProps={opts.type === 'date' ? { inputLabel: { shrink: true } } : undefined}
        onChange={(e) => {
          const raw = e.target.value;
          if (opts.type === 'number') update(path, raw === '' ? undefined : Number(raw));
          else update(path, raw);
        }}
      />
    );
  };

  const select = (label: string, path: Path, options: { value: string; label: string }[]) => {
    const value = String(getAt(draft, path) ?? '');
    const known = options.some((o) => o.value === value);
    return (
      <TextField select label={label} size="small" value={value} onChange={(e) => update(path, e.target.value)}>
        {!known && value !== '' && <MenuItem value={value}>{value}</MenuItem>}
        {options.map((o) => (
          <MenuItem key={o.value} value={o.value}>
            {o.label}
          </MenuItem>
        ))}
      </TextField>
    );
  };

  const stateOptions = ALL_STATES.map((s) => ({ value: s, label: s }));
  const allowedStates = partner.connection?.allowedStates ?? partner.catalog?.allowedStates ?? [];
  const items = Array.isArray(draft.items) ? (draft.items as Record<string, unknown>[]) : [];
  const npi = String(getAt(draft, ['prescriber', 'npi']) ?? '');
  const npiValid = isValidNpi(npi);
  const shipState = String(getAt(draft, ['patient', 'shipTo', 'state']) ?? '');
  const stateAllowed = !allowedStates.length || allowedStates.includes(shipState);
  const allergies = getAt(draft, ['patient', 'allergies']);

  const lastCode = result ? problemCode(result.call.body) : null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {!partner.catalog && (
        <Alert severity="warning">
          This partner&apos;s catalog hasn&apos;t been synced, so Randomize can&apos;t pick real SKUs, shipping methods or
          allowed states. Use <strong>Sync connection &amp; catalog</strong> above first.
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mr: 1 }}>
            Preset
          </Typography>
          {PRESETS.map((p) => (
            <Tooltip key={p.id} title={`${p.description} Expect: ${p.expect}.`}>
              <Chip
                label={p.label}
                onClick={() => randomize(p.id)}
                color={preset === p.id ? 'primary' : 'default'}
                variant={preset === p.id ? 'filled' : 'outlined'}
                size="small"
              />
            </Tooltip>
          ))}
          <Box sx={{ flex: 1 }} />
          <Button variant="contained" startIcon={<CasinoOutlinedIcon />} onClick={() => randomize(preset)}>
            Randomize
          </Button>
        </Box>
        <Typography variant="body2" color="text.secondary">
          Expect: <strong>{expect}</strong>
        </Typography>
        {warnings.map((w) => (
          <Alert key={w} severity="warning" sx={{ mt: 1 }}>
            {w}
          </Alert>
        ))}
      </Paper>

      <Tabs value={mode} onChange={(_, v) => switchMode(v)} sx={{ minHeight: 36 }}>
        <Tab value="form" label="Form" sx={{ minHeight: 36 }} />
        <Tab value="json" label="Raw JSON" sx={{ minHeight: 36 }} />
      </Tabs>
      {jsonError && <Alert severity="error">Invalid JSON: {jsonError}</Alert>}

      {mode === 'json' ? (
        <TextField
          multiline
          minRows={20}
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          slotProps={{ input: { sx: { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.8rem' } } }}
          helperText="Sent exactly as written, so you can also remove required fields or send wrong types to test 400 invalid_request."
        />
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Section
            title="Order"
            action={
              <Button size="small" startIcon={<AutorenewIcon />} onClick={() => update(['partnerOrderId'], newPartnerOrderId(Math.random, new Date()))}>
                New partnerOrderId
              </Button>
            }
          >
            <Box sx={grid(3)}>
              {text('partnerOrderId', ['partnerOrderId'])}
              {shippingMethods.length
                ? select(
                    'shippingMethod',
                    ['shippingMethod'],
                    shippingMethods.map((m) => ({
                      value: m.code,
                      label: `${m.label ?? m.code}${m.priceCents !== undefined ? ` ($${(m.priceCents / 100).toFixed(2)})` : ''}`,
                    })),
                  )
                : text('shippingMethod', ['shippingMethod'], { placeholder: 'Sync the catalog' })}
              {text('payment.status', ['payment', 'status'], { helper: 'v1 accepts prepaid only' })}
            </Box>
            <Box sx={{ display: 'flex', gap: 3, mt: 1 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={getAt(draft, ['attestations', 'validRelationship']) === true}
                    onChange={(e) => update(['attestations', 'validRelationship'], e.target.checked)}
                  />
                }
                label="attestations.validRelationship"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={getAt(draft, ['attestations', 'prescriberSigned']) === true}
                    onChange={(e) => update(['attestations', 'prescriberSigned'], e.target.checked)}
                  />
                }
                label="attestations.prescriberSigned"
              />
            </Box>
          </Section>

          <Section title="Patient">
            <Box sx={grid(4)}>
              {text('First name', ['patient', 'firstName'])}
              {text('Last name', ['patient', 'lastName'])}
              {text('Date of birth', ['patient', 'dateOfBirth'], { type: 'date' })}
              {select('Sex', ['patient', 'sex'], [
                { value: 'F', label: 'F' },
                { value: 'M', label: 'M' },
                { value: 'U', label: 'U' },
              ])}
              {text('Phone', ['patient', 'phone'])}
              {text('Email', ['patient', 'email'])}
              <TextField
                label="Allergies (comma-separated)"
                size="small"
                value={Array.isArray(allergies) ? allergies.join(', ') : ''}
                onChange={(e) =>
                  update(
                    ['patient', 'allergies'],
                    e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  )
                }
                helperText='"NKDA" for none'
              />
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2, mb: 1 }}>
              Ship to
            </Typography>
            <Box sx={grid(5)}>
              {text('Line 1', ['patient', 'shipTo', 'line1'])}
              {text('Line 2', ['patient', 'shipTo', 'line2'])}
              {text('City', ['patient', 'shipTo', 'city'])}
              <TextField
                select
                label="State"
                size="small"
                value={shipState}
                onChange={(e) => update(['patient', 'shipTo', 'state'], e.target.value)}
                error={!stateAllowed}
                helperText={!stateAllowed ? 'Not an allowed state' : allowedStates.length ? 'Allowed' : undefined}
              >
                {stateOptions.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                    {allowedStates.includes(o.value) ? ' ✓' : ''}
                  </MenuItem>
                ))}
              </TextField>
              {text('ZIP', ['patient', 'shipTo', 'zip'])}
            </Box>
          </Section>

          <Section
            title="Prescriber"
            action={
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                {prescribers.length > 0 && (
                  <TextField
                    select
                    size="small"
                    label="Reuse a saved prescriber"
                    value=""
                    sx={{ minWidth: 240 }}
                    onChange={(e) => {
                      const p = prescribers.find((x) => x.id === e.target.value);
                      if (!p) return;
                      update(['prescriber'], {
                        npi: p.npi,
                        firstName: p.first_name,
                        lastName: p.last_name,
                        stateLicense: { state: p.license_state, number: p.license_number },
                      });
                    }}
                  >
                    {prescribers.map((p) => (
                      <MenuItem key={p.id} value={p.id}>
                        {p.first_name} {p.last_name} · {p.npi} · {p.license_state}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
                <Button
                  size="small"
                  startIcon={<CasinoOutlinedIcon />}
                  onClick={() => update(['prescriber'], randomPrescriber(Math.random, shipState || 'UT'))}
                >
                  New prescriber
                </Button>
              </Box>
            }
          >
            <Box sx={grid(5)}>
              {text('NPI', ['prescriber', 'npi'], {
                helper: npi ? (npiValid ? 'Check digit valid' : 'Check digit INVALID') : undefined,
                error: !!npi && !npiValid,
              })}
              {text('First name', ['prescriber', 'firstName'])}
              {text('Last name', ['prescriber', 'lastName'])}
              {select('Licence state', ['prescriber', 'stateLicense', 'state'], stateOptions)}
              {text('Licence number', ['prescriber', 'stateLicense', 'number'])}
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              A new prescriber&apos;s first order waits in the pharmacy&apos;s Partner Inbox for a licence review. Accepted
              orders save their prescriber here automatically.
            </Typography>
          </Section>

          <Section title="Encounter">
            <Box sx={grid(4)}>
              {text('Date', ['encounter', 'date'], { type: 'date' })}
              {select('Modality', ['encounter', 'modality'], [
                { value: 'async', label: 'async (questionnaire)' },
                { value: 'sync', label: 'sync (live visit)' },
              ])}
            </Box>
          </Section>

          <Section
            title={`Items (${items.length})`}
            action={
              <Button
                size="small"
                startIcon={<AddIcon />}
                disabled={items.length >= 20}
                onClick={() =>
                  update(['items'], [
                    ...items,
                    { sku: catalogItems[0]?.sku ?? '', quantity: 1, sig: 'Take 1 capsule by mouth once daily', daysSupply: 30 },
                  ])
                }
              >
                Add item
              </Button>
            }
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {items.map((item, i) => {
                const sku = String(item.sku ?? '');
                const entry = catalogItems.find((c) => c.sku === sku);
                const needsRationale = !!entry?.rationaleRequired;
                return (
                  <Box key={i} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
                    <Autocomplete
                      freeSolo
                      size="small"
                      sx={{ minWidth: 280, flex: 2 }}
                      options={catalogItems.map((c) => c.sku)}
                      inputValue={sku}
                      onInputChange={(_, v) => update(['items', i, 'sku'], v)}
                      renderOption={(props, option) => {
                        const c = catalogItems.find((x) => x.sku === option);
                        const { key, ...rest } = props as typeof props & { key: string };
                        return (
                          <li key={key} {...rest}>
                            <Box>
                              <Typography variant="body2">{c?.productName ?? option}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {option}
                                {c?.priceCents !== undefined ? ` · $${(c.priceCents / 100).toFixed(2)}` : ''}
                                {c?.rationaleRequired ? ' · rationale required' : ''}
                                {c?.available === false ? ' · unavailable' : ''}
                              </Typography>
                            </Box>
                          </li>
                        );
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label={`Item ${i + 1} SKU`}
                          helperText={entry ? entry.productName : sku ? 'Not in the catalog' : undefined}
                        />
                      )}
                    />
                    <Box sx={{ width: 90 }}>{text('Qty', ['items', i, 'quantity'], { type: 'number' })}</Box>
                    <Box sx={{ width: 110 }}>{text('Days supply', ['items', i, 'daysSupply'], { type: 'number' })}</Box>
                    <Box sx={{ flex: 3, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {text('SIG', ['items', i, 'sig'])}
                      {(needsRationale || getAt(item, ['clinicalRationale']) !== undefined) && (
                        <TextField
                          size="small"
                          label={`Clinical rationale${needsRationale ? ' (required)' : ''}`}
                          value={String(getAt(item, ['clinicalRationale', 'text']) ?? '')}
                          onChange={(e) =>
                            update(['items', i, 'clinicalRationale'], e.target.value ? { text: e.target.value } : undefined)
                          }
                        />
                      )}
                    </Box>
                    <IconButton
                      aria-label="Remove item"
                      onClick={() => update(['items'], items.filter((_, j) => j !== i))}
                      sx={{ mt: 0.5 }}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Box>
                );
              })}
              {items.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No items. (Sending none should be refused with 400 invalid_request.)
                </Typography>
              )}
            </Box>
          </Section>
        </Box>
      )}

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
          Idempotency-Key
        </Typography>
        <RadioGroup row value={keyMode} onChange={(e) => setKeyMode(e.target.value as typeof keyMode)}>
          <FormControlLabel value="auto" control={<Radio size="small" />} label="New UUID for each send" />
          <FormControlLabel value="custom" control={<Radio size="small" />} label="Use this key" />
          <FormControlLabel value="none" control={<Radio size="small" />} label="Send none (expect 400)" />
        </RadioGroup>
        {keyMode === 'custom' && (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 1 }}>
            <TextField
              size="small"
              sx={{ flex: 1, maxWidth: 480 }}
              value={customKey}
              onChange={(e) => setCustomKey(e.target.value)}
              placeholder="any key"
              helperText="Same key + same body replays the first answer; same key + a different body is 409 idempotency_key_reused."
            />
            {result?.order.idempotency_key && (
              <Button size="small" onClick={() => setCustomKey(result.order.idempotency_key)}>
                Use last key
              </Button>
            )}
          </Box>
        )}
        <Box sx={{ display: 'flex', gap: 1.5, mt: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            size="large"
            startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <SendIcon />}
            disabled={submitting || (keyMode === 'custom' && !customKey.trim())}
            onClick={handleSubmit}
          >
            Send order
          </Button>
          <Typography variant="caption" color="text.secondary">
            POST {partner.api_url ?? '…'}/v1/orders from {partner.call_mode === 'browser' ? 'your browser' : "TCM's server"} as{' '}
            {partner.name} ({partner.api_key_mode} key …{partner.api_key_last4})
          </Typography>
        </Box>
        {submitError && (
          <Alert severity="error" sx={{ mt: 1.5 }}>
            {submitError}
          </Alert>
        )}
      </Paper>

      {result && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mb: 1.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Result
            </Typography>
            <HttpChip status={result.call.status} code={lastCode} />
            {result.order.preset && (
              <Typography variant="body2" color="text.secondary">
                expected {PRESETS.find((p) => p.id === result.order.preset)?.expect ?? '—'}
              </Typography>
            )}
            <Box sx={{ flex: 1 }} />
            <Tooltip title="Send the identical body with the same Idempotency-Key. FullStackRx should replay its first answer (Idempotent-Replayed: true) without creating anything.">
              <span>
                <Button size="small" startIcon={<ReplayIcon />} onClick={handleRetry} disabled={submitting}>
                  Retry with same key
                </Button>
              </span>
            </Tooltip>
            <Button size="small" startIcon={<OpenInNewIcon />} onClick={() => onOpenOrder(result.order.id)}>
              Open order
            </Button>
          </Box>
          {result.call.body && typeof result.call.body === 'object' && 'detail' in (result.call.body as object) ? (
            <Alert severity={result.call.ok ? 'info' : 'warning'} sx={{ mb: 1.5 }}>
              {String((result.call.body as { detail?: unknown }).detail)}
            </Alert>
          ) : null}
          <CallResultView call={result.call} requestBody={result.order.request_body} />
        </Paper>
      )}
    </Box>
  );
}
