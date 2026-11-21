import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ageOn, PRESETS, randomizeOrder, type RandomizeContext } from '../randomizer';
import { isValidNpi } from '../npi';
import { STATE_ADDRESSES } from '../fake-data';
import type { OrderPreset, PartnerCatalog, PartnerConnection } from '../types';
import { seededRng } from './rng';

const today = new Date(2026, 10, 21); // 21 Nov 2026, local time

const catalog: PartnerCatalog = {
  items: [
    { sku: 'FS-101', productName: 'Progesterone 200mg', available: true, maxQuantity: 1, rationaleRequired: false },
    { sku: 'FS-102', productName: 'Testosterone Cyp', available: true, maxQuantity: 5, rationaleRequired: true },
    { sku: 'FS-103', productName: 'LDN 4.5mg', available: true, maxQuantity: 2, rationaleRequired: false },
    { sku: 'FS-104', productName: 'Out of stock', available: false, maxQuantity: 1 },
  ],
  shippingMethods: [
    { code: 'usps_priority', label: 'USPS Priority', priceCents: 900 },
    { code: 'ups_2day', label: 'UPS 2-day', priceCents: 1500 },
  ],
  allowedStates: ['UT', 'ID', 'NV'],
};
const connection: PartnerConnection = { status: 'active', allowedStates: ['UT', 'ID'] };

const saved = {
  npi: '1234567893',
  first_name: 'Dana',
  last_name: 'Telehealth',
  license_state: 'UT',
  license_number: 'TEST-123456',
};

const ctx = (seed: number, extra: Partial<RandomizeContext> = {}): RandomizeContext => ({
  catalog,
  connection,
  rng: seededRng(seed),
  today,
  ...extra,
});

test('happy path builds a contract-valid order from the catalog and connection', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const { order, warnings } = randomizeOrder('happy_path', ctx(seed, { savedPrescribers: [saved] }));
    assert.deepEqual(warnings, []);

    assert.match(order.partnerOrderId, /^[A-Za-z0-9._:-]{1,100}$/);
    assert.match(order.partnerOrderId, /^TCM-261121-/);

    const p = order.patient;
    assert.ok(['UT', 'ID'].includes(p.shipTo.state), 'ships to a connection-allowed state');
    assert.equal(p.shipTo.zip, STATE_ADDRESSES[p.shipTo.state].zip);
    assert.match(p.shipTo.zip, /^\d{5}$/);
    assert.ok(['F', 'M'].includes(p.sex));
    assert.match(p.phone!, /^\d{3}55501\d{2}$/);
    assert.match(p.email!, /@example\.com$/);
    assert.ok(p.allergies.length > 0);
    assert.ok(Array.isArray(p.conditions) && Array.isArray(p.medications), 'always sent, so never "Unknown"');
    for (const list of [p.allergies, p.conditions!, p.medications!]) {
      assert.equal(new Set(list).size, list.length, 'no duplicates');
      for (const v of list) assert.ok(v.length > 0 && v.length <= 200 && !v.includes(','), v);
    }
    const age = ageOn(p.dateOfBirth, today);
    assert.ok(age >= 18 && age <= 80, `age ${age}`);

    // Reuses the saved prescriber, licensed in the patient's state.
    assert.equal(order.prescriber.npi, saved.npi);
    assert.equal(order.prescriber.stateLicense.state, 'UT');
    assert.equal(p.shipTo.state, 'UT');

    assert.equal(order.encounter.date, '2026-11-21');
    assert.ok(['sync', 'async'].includes(order.encounter.modality));

    assert.ok(order.items.length >= 1 && order.items.length <= 3);
    const skus = order.items.map((i) => i.sku);
    assert.equal(new Set(skus).size, skus.length, 'no SKU twice');
    for (const item of order.items) {
      const entry = catalog.items!.find((c) => c.sku === item.sku)!;
      assert.ok(entry && entry.available, 'only available catalog SKUs');
      assert.ok(item.quantity! >= 1 && item.quantity! <= Math.min(entry.maxQuantity ?? 3, 3));
      assert.ok(item.sig.length > 0);
      assert.ok([30, 90].includes(item.daysSupply!));
      assert.equal(!!item.clinicalRationale, !!entry.rationaleRequired, `rationale for ${item.sku}`);
    }

    assert.deepEqual(order.payment, { status: 'prepaid' });
    assert.ok(['usps_priority', 'ups_2day'].includes(order.shippingMethod));
    assert.deepEqual(order.attestations, { validRelationship: true, prescriberSigned: true });
  }
});

test('happy path with no saved prescriber invents a valid one and warns it will go to the inbox', () => {
  const { order, warnings } = randomizeOrder('happy_path', ctx(3));
  assert.ok(isValidNpi(order.prescriber.npi));
  assert.equal(order.prescriber.stateLicense.state, order.patient.shipTo.state);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /Partner Inbox/);
});

test('clinical info: real allergies, conditions and medications most of the time', () => {
  let realAllergies = 0, withConditions = 0, withMeds = 0;
  const runs = 400;
  for (let seed = 1; seed <= runs; seed++) {
    const { patient } = randomizeOrder('happy_path', ctx(seed)).order;
    if (!(patient.allergies.length === 1 && patient.allergies[0] === 'NKDA')) realAllergies++;
    else assert.deepEqual(patient.allergies, ['NKDA']);
    if (patient.conditions!.length) withConditions++;
    if (patient.medications!.length) withMeds++;
    assert.ok(patient.conditions!.length <= 2 && patient.medications!.length <= 3);
  }
  // Roughly 75% / 80% / 80%; loose bounds keep this stable.
  for (const [name, n] of [['allergies', realAllergies], ['conditions', withConditions], ['medications', withMeds]] as const) {
    assert.ok(n > runs * 0.6 && n < runs * 0.95, `${name}: ${n}/${runs}`);
  }
});

test('new prescriber never reuses a saved one', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const { order } = randomizeOrder('new_prescriber', ctx(seed, { savedPrescribers: [saved] }));
    assert.notEqual(order.prescriber.npi, saved.npi);
    assert.ok(isValidNpi(order.prescriber.npi));
  }
});

test('bad NPI is ten digits with a wrong check digit', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const { order, expect } = randomizeOrder('bad_npi', ctx(seed, { savedPrescribers: [saved] }));
    assert.match(order.prescriber.npi, /^\d{10}$/);
    assert.equal(isValidNpi(order.prescriber.npi), false);
    assert.equal(expect, '422 invalid_npi');
  }
});

test('disallowed state ships outside the allowed states', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const { order, warnings } = randomizeOrder('disallowed_state', ctx(seed));
    assert.ok(!['UT', 'ID'].includes(order.patient.shipTo.state), order.patient.shipTo.state);
    assert.deepEqual(warnings, []);
  }
});

test('unknown SKU puts a SKU that is not in the catalog first', () => {
  const { order } = randomizeOrder('unknown_sku', ctx(5));
  assert.match(order.items[0].sku, /^TCM-UNKNOWN-\d{6}$/);
  assert.ok(!catalog.items!.some((c) => c.sku === order.items[0].sku));
});

test('duplicate reuses the most recent accepted partnerOrderId, or warns when there is none', () => {
  const dup = randomizeOrder('duplicate_order', ctx(1, { previousPartnerOrderIds: ['TCM-261120-AAAAAA', 'older'] }));
  assert.equal(dup.order.partnerOrderId, 'TCM-261120-AAAAAA');
  const none = randomizeOrder('duplicate_order', ctx(1));
  assert.match(none.warnings.join(' '), /nothing to duplicate/);
});

test('not prepaid and missing attestation break exactly one field', () => {
  assert.equal(randomizeOrder('not_prepaid', ctx(1)).order.payment.status, 'invoice');
  const att = randomizeOrder('missing_attestation', ctx(1)).order.attestations;
  assert.deepEqual(att, { validRelationship: true, prescriberSigned: false });
});

test('falls back to the catalog allowed states when the connection lists none', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const { order } = randomizeOrder('happy_path', ctx(seed, { connection: { allowedStates: [] } }));
    assert.ok(['UT', 'ID', 'NV'].includes(order.patient.shipTo.state));
  }
});

test('with nothing synced it still builds an order, and says what is missing', () => {
  const { order, warnings } = randomizeOrder('happy_path', { catalog: null, connection: null, rng: seededRng(9), today });
  assert.equal(order.items.length, 1);
  assert.equal(order.shippingMethod, '');
  assert.ok(warnings.some((w) => /allowed states/.test(w)));
  assert.ok(warnings.some((w) => /no orderable items/.test(w)));
  assert.ok(warnings.some((w) => /no shipping methods/.test(w)));
});

test('the same seed gives the same order', () => {
  const a = randomizeOrder('happy_path', ctx(1234));
  const b = randomizeOrder('happy_path', ctx(1234));
  assert.deepEqual(a, b);
});

test('every preset has a label and an expectation', () => {
  const ids: OrderPreset[] = [
    'happy_path', 'new_prescriber', 'bad_npi', 'disallowed_state',
    'unknown_sku', 'duplicate_order', 'not_prepaid', 'missing_attestation',
  ];
  assert.deepEqual(PRESETS.map((p) => p.id).sort(), [...ids].sort());
  for (const p of PRESETS) assert.ok(p.label && p.expect && p.description);
});

test('ages stay within 18 to 80 on leap-day and year-end edges', () => {
  for (const day of [new Date(2028, 1, 29), new Date(2026, 11, 31), new Date(2027, 0, 1)]) {
    for (let seed = 1; seed <= 300; seed++) {
      const { order } = randomizeOrder('happy_path', { catalog, connection, rng: seededRng(seed), today: day });
      const age = ageOn(order.patient.dateOfBirth, day);
      assert.ok(age >= 18 && age <= 80, `${order.patient.dateOfBirth} on ${day.toDateString()} is ${age}`);
    }
  }
});
