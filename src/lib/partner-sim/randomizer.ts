/**
 * Builds a random, contract-valid partner order (or a deliberately broken one for a
 * negative-path preset) from a partner's cached catalog and connection. Pure: pass an
 * rng and a date to make it deterministic. Runs in the browser and in tests.
 */

import { generateInvalidNpi, generateNpi, type Rng } from './npi';
import {
  ALL_STATES,
  ALLERGIES,
  CONDITIONS,
  MEDICATIONS,
  FIRST_NAMES_F,
  FIRST_NAMES_M,
  LAST_NAMES,
  RATIONALES,
  SIGS,
  STATE_ADDRESSES,
  STREET_NAMES,
} from './fake-data';
import type {
  OrderPreset,
  PartnerCatalog,
  PartnerConnection,
  PartnerOrderItemInput,
  PartnerOrderRequest,
  PartnerPrescriber,
} from './types';

export interface SavedPrescriberLike {
  npi: string;
  first_name: string;
  last_name: string;
  license_state: string;
  license_number: string;
}

export interface RandomizeContext {
  catalog: PartnerCatalog | null | undefined;
  connection: PartnerConnection | null | undefined;
  /** Saved prescribers, most recently used first. */
  savedPrescribers?: SavedPrescriberLike[];
  /** partnerOrderIds FullStackRx already accepted (201), most recent first. */
  previousPartnerOrderIds?: string[];
  rng?: Rng;
  today?: Date;
}

export interface RandomizeResult {
  order: PartnerOrderRequest;
  /** What QA should expect back from FullStackRx. */
  expect: string;
  /** Things that may stop the preset doing what it says (e.g. no saved prescriber). */
  warnings: string[];
}

export interface PresetInfo {
  id: OrderPreset;
  label: string;
  expect: string;
  description: string;
}

export const PRESETS: PresetInfo[] = [
  {
    id: 'happy_path',
    label: 'Happy path',
    expect: '201 received, then order.accepted',
    description: 'Valid order. Reuses the most recent saved prescriber so it skips the licence review.',
  },
  {
    id: 'new_prescriber',
    label: 'New prescriber (goes to inbox)',
    expect: '201 received, then order.needs_attention',
    description: "A brand-new prescriber: the first order waits in the pharmacy's Partner Inbox for a licence review.",
  },
  {
    id: 'bad_npi',
    label: 'Bad NPI',
    expect: '422 invalid_npi',
    description: 'Ten digits with a wrong check digit.',
  },
  {
    id: 'disallowed_state',
    label: 'Disallowed state',
    expect: '422 state_not_allowed',
    description: "Ships to a state outside the connection's allowed states.",
  },
  {
    id: 'unknown_sku',
    label: 'Unknown SKU',
    expect: '422 unknown_sku',
    description: "Orders a SKU that isn't in the catalog.",
  },
  {
    id: 'duplicate_order',
    label: 'Duplicate partnerOrderId',
    expect: '409 duplicate_order',
    description: 'Reuses the partnerOrderId of an order already accepted, with a new Idempotency-Key.',
  },
  {
    id: 'not_prepaid',
    label: 'Not prepaid',
    expect: '422 payment_required',
    description: 'payment.status is "invoice" instead of "prepaid".',
  },
  {
    id: 'missing_attestation',
    label: 'Missing attestation',
    expect: '422 attestation_required',
    description: 'attestations.prescriberSigned is false.',
  },
];

const pick = <T>(rng: Rng, list: readonly T[]): T => list[Math.floor(rng() * list.length)];
const int = (rng: Rng, min: number, max: number) => min + Math.floor(rng() * (max - min + 1));
/** `min` to `max` distinct entries from a list, in list order. */
function pickSome<T>(rng: Rng, list: readonly T[], min: number, max: number): T[] {
  const count = Math.min(int(rng, min, max), list.length);
  const pool = list.map((v, i) => ({ v, i }));
  const chosen: { v: T; i: number }[] = [];
  for (let k = 0; k < count; k++) chosen.push(...pool.splice(Math.floor(rng() * pool.length), 1));
  return chosen.sort((a, b) => a.i - b.i).map((c) => c.v);
}
const digits = (rng: Rng, n: number) => Array.from({ length: n }, () => int(rng, 0, 9)).join('');

const pad = (n: number) => String(n).padStart(2, '0');
/** YYYY-MM-DD of a date in its local calendar. */
export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** A date of birth that makes the patient between 18 and 80 years old today. */
export function randomDateOfBirth(rng: Rng, today: Date): string {
  const y = today.getFullYear();
  const m = today.getMonth();
  const d = today.getDate();
  const youngest = new Date(y - 18, m, d); // turned 18 today
  const oldest = new Date(y - 81, m, d + 1); // turns 81 tomorrow, so 80 today
  const span = Math.floor((youngest.getTime() - oldest.getTime()) / 86_400_000);
  const dob = new Date(oldest.getFullYear(), oldest.getMonth(), oldest.getDate() + int(rng, 0, span));
  return isoDate(dob);
}

/** Age in whole years on `today` for a YYYY-MM-DD date of birth. */
export function ageOn(dateOfBirth: string, today: Date): number {
  const [by, bm, bd] = dateOfBirth.split('-').map(Number);
  let age = today.getFullYear() - by;
  if (today.getMonth() + 1 < bm || (today.getMonth() + 1 === bm && today.getDate() < bd)) age--;
  return age;
}

export function newPartnerOrderId(rng: Rng, today: Date): string {
  const stamp = `${String(today.getFullYear()).slice(2)}${pad(today.getMonth() + 1)}${pad(today.getDate())}`;
  const suffix = Array.from({ length: 6 }, () => '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'[int(rng, 0, 33)]).join('');
  return `TCM-${stamp}-${suffix}`;
}

/** The states the connection accepts that we also have a fake address for. */
export function allowedStatesFor(
  connection: PartnerConnection | null | undefined,
  catalog: PartnerCatalog | null | undefined,
): { states: string[]; known: boolean } {
  const fromApi = connection?.allowedStates?.length
    ? connection.allowedStates
    : catalog?.allowedStates ?? [];
  const states = fromApi.map((s) => s.toUpperCase()).filter((s) => s in STATE_ADDRESSES);
  return states.length ? { states, known: true } : { states: ALL_STATES, known: false };
}

export function randomPrescriber(rng: Rng, licenseState: string): PartnerPrescriber {
  const female = rng() < 0.5;
  return {
    npi: generateNpi(rng),
    firstName: pick(rng, female ? FIRST_NAMES_F : FIRST_NAMES_M),
    lastName: pick(rng, LAST_NAMES),
    stateLicense: { state: licenseState, number: `TCM-${digits(rng, 6)}` },
  };
}

export function randomizeOrder(preset: OrderPreset, ctx: RandomizeContext): RandomizeResult {
  const rng = ctx.rng ?? Math.random;
  const today = ctx.today ?? new Date();
  const warnings: string[] = [];
  const info = PRESETS.find((p) => p.id === preset) ?? PRESETS[0];

  // --- where the patient lives ------------------------------------------------------
  const allowed = allowedStatesFor(ctx.connection, ctx.catalog);
  if (!allowed.known) {
    warnings.push('No allowed states known yet. Sync the connection so the ship-to state is one it accepts.');
  }
  const saved = ctx.savedPrescribers ?? [];
  const reuse = preset !== 'new_prescriber' && preset !== 'bad_npi' && saved.length > 0 ? saved[0] : null;

  let state: string;
  if (preset === 'disallowed_state') {
    const outside = ALL_STATES.filter((s) => !allowed.states.includes(s));
    if (!allowed.known || outside.length === 0) {
      warnings.push('Every state is allowed (or none are known), so no disallowed state is available.');
      state = pick(rng, allowed.states);
    } else {
      state = pick(rng, outside);
    }
  } else if (reuse && allowed.states.includes(reuse.license_state)) {
    state = reuse.license_state; // the licence should be for the patient's state
  } else {
    state = pick(rng, allowed.states);
  }
  const place = STATE_ADDRESSES[state];

  // --- patient ----------------------------------------------------------------------
  const female = rng() < 0.5;
  const firstName = pick(rng, female ? FIRST_NAMES_F : FIRST_NAMES_M);
  const lastName = pick(rng, LAST_NAMES);
  const patient = {
    firstName,
    lastName,
    dateOfBirth: randomDateOfBirth(rng, today),
    sex: female ? 'F' : 'M',
    phone: `${place.areaCode}55501${digits(rng, 2)}`,
    email: `${firstName}.${lastName}.${digits(rng, 4)}@example.com`.toLowerCase(),
    shipTo: {
      line1: `${int(rng, 100, 9899)} ${pick(rng, STREET_NAMES)}`,
      city: place.city,
      state,
      zip: place.zip,
    },
    // Real values most of the time, so the order and script PDF show them; sometimes "none".
    allergies: rng() < 0.25 ? ['NKDA'] : pickSome(rng, ALLERGIES, 1, 2),
    conditions: rng() < 0.2 ? [] : pickSome(rng, CONDITIONS, 1, 2),
    medications: rng() < 0.2 ? [] : pickSome(rng, MEDICATIONS, 1, 3),
  };

  // --- prescriber -------------------------------------------------------------------
  let prescriber: PartnerPrescriber;
  if (reuse) {
    prescriber = {
      npi: reuse.npi,
      firstName: reuse.first_name,
      lastName: reuse.last_name,
      stateLicense: { state: reuse.license_state, number: reuse.license_number },
    };
    if (reuse.license_state !== state && preset !== 'disallowed_state') {
      warnings.push(
        `The saved prescriber is licensed in ${reuse.license_state}, which this connection doesn't accept; the licence won't match the patient's state.`,
      );
    }
  } else {
    prescriber = randomPrescriber(rng, state);
    if (preset === 'happy_path') {
      warnings.push(
        "No saved prescriber yet, so this is a new one and its first order will wait in the pharmacy's Partner Inbox. Approve it there, then later orders go straight through.",
      );
    }
  }
  if (preset === 'bad_npi') prescriber.npi = generateInvalidNpi(rng);

  // --- items ------------------------------------------------------------------------
  const orderable = (ctx.catalog?.items ?? []).filter((i) => i.available !== false && i.sku);
  let items: PartnerOrderItemInput[];
  if (orderable.length === 0) {
    warnings.push('The catalog has no orderable items yet. Sync the catalog, or type a SKU in.');
    items = [{ sku: 'SYNC-THE-CATALOG', quantity: 1, sig: pick(rng, SIGS), daysSupply: 30 }];
  } else {
    const pool = [...orderable];
    const count = Math.min(int(rng, 1, 3), pool.length);
    items = [];
    for (let i = 0; i < count; i++) {
      const [entry] = pool.splice(Math.floor(rng() * pool.length), 1);
      const maxQ = Math.max(1, Math.min(entry.maxQuantity ?? 3, 3));
      const item: PartnerOrderItemInput = {
        sku: entry.sku,
        quantity: int(rng, 1, maxQ),
        sig: pick(rng, SIGS),
        daysSupply: pick(rng, [30, 30, 90]),
      };
      if (entry.rationaleRequired) item.clinicalRationale = { text: pick(rng, RATIONALES) };
      items.push(item);
    }
  }
  if (preset === 'unknown_sku') {
    items[0] = { ...items[0], sku: `TCM-UNKNOWN-${digits(rng, 6)}` };
    delete items[0].clinicalRationale;
  }

  // --- the rest ---------------------------------------------------------------------
  const shippingMethods = ctx.catalog?.shippingMethods ?? [];
  if (shippingMethods.length === 0) warnings.push('The catalog has no shipping methods yet. Sync the catalog.');

  let partnerOrderId = newPartnerOrderId(rng, today);
  if (preset === 'duplicate_order') {
    const previous = ctx.previousPartnerOrderIds ?? [];
    if (previous.length) partnerOrderId = previous[0];
    else warnings.push('No order has been accepted for this partner yet, so there is nothing to duplicate. Send one first.');
  }

  const order: PartnerOrderRequest = {
    partnerOrderId,
    patient,
    prescriber,
    encounter: { date: isoDate(today), modality: rng() < 0.5 ? 'async' : 'sync' },
    items,
    payment: { status: preset === 'not_prepaid' ? 'invoice' : 'prepaid' },
    shippingMethod: shippingMethods.length ? pick(rng, shippingMethods).code : '',
    attestations: {
      validRelationship: true,
      prescriberSigned: preset !== 'missing_attestation',
    },
  };

  return { order, expect: info.expect, warnings };
}
