import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTimeline, indexEvent } from '../webhook-events';

const noHeaders = { get: () => null };

test('indexEvent reads the event and order ids from the body', () => {
  const fields = indexEvent(
    {
      id: 'evt_1',
      type: 'order.shipped',
      createdAt: '2026-11-21T06:48:11.535359Z',
      livemode: false,
      data: { orderId: 'o-1', partnerOrderId: 'TCM-1', itemId: 'i-1', trackingUrl: 'x' },
    },
    noHeaders,
  );
  assert.deepEqual(fields, {
    event_id: 'evt_1',
    event_type: 'order.shipped',
    event_created_at: '2026-11-21T06:48:11.535359Z',
    livemode: false,
    fsrx_order_id: 'o-1',
    partner_order_id: 'TCM-1',
    item_id: 'i-1',
  });
});

test('indexEvent falls back to the FullStackRx-Event-* headers for an unparseable body', () => {
  const headers = new Headers({ 'FullStackRx-Event-Id': 'evt_h', 'FullStackRx-Event-Type': 'catalog.updated' });
  const fields = indexEvent(null, headers);
  assert.equal(fields.event_id, 'evt_h');
  assert.equal(fields.event_type, 'catalog.updated');
  assert.equal(fields.fsrx_order_id, null);
  assert.equal(indexEvent({ createdAt: 'not a date' }, noHeaders).event_created_at, null);
});

const ev = (event_id: string | null, event_created_at: string | null, received_at: string) => ({
  event_id,
  event_created_at,
  received_at,
});

test('buildTimeline orders by createdAt, not by arrival, and dedupes on event id', () => {
  // Arrival order: processing, accepted, received (as in a real delivery log), plus a redelivery.
  const events = [
    ev('evt_proc', '2026-11-21T06:30:42.007Z', '2026-11-21T06:30:43Z'),
    ev('evt_acc', '2026-11-21T06:30:41.976Z', '2026-11-21T06:30:44Z'),
    ev('evt_rec', '2026-11-21T06:30:41.781Z', '2026-11-21T06:30:45Z'),
    ev('evt_acc', '2026-11-21T06:30:41.976Z', '2026-11-21T06:31:44Z'),
  ];
  assert.deepEqual(
    buildTimeline(events).map((e) => e.event_id),
    ['evt_rec', 'evt_acc', 'evt_proc'],
  );
  // The first delivery of a duplicate is the one kept.
  assert.equal(buildTimeline(events).find((e) => e.event_id === 'evt_acc')!.received_at, '2026-11-21T06:30:44Z');
});

test('buildTimeline keeps events without an id and puts undated ones last', () => {
  const events = [
    ev(null, null, '2026-11-21T07:00:00Z'),
    ev(null, '2026-11-21T06:00:00Z', '2026-11-21T07:00:01Z'),
    ev('evt_a', '2026-11-21T05:00:00Z', '2026-11-21T07:00:02Z'),
  ];
  assert.deepEqual(
    buildTimeline(events).map((e) => e.event_created_at),
    ['2026-11-21T05:00:00Z', '2026-11-21T06:00:00Z', null],
  );
});
