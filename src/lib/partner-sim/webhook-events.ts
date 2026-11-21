/** Pure helpers for webhook events: pull out the fields we index, and build a timeline. */

/** Headers worth keeping from a delivery (never cookies or auth). */
export const KEPT_WEBHOOK_HEADERS = [
  'content-type',
  'user-agent',
  'fullstackrx-signature',
  'fullstackrx-event-id',
  'fullstackrx-event-type',
];

export interface IndexedEventFields {
  event_id: string | null;
  event_type: string | null;
  event_created_at: string | null;
  livemode: boolean | null;
  fsrx_order_id: string | null;
  partner_order_id: string | null;
  item_id: string | null;
}

const str = (v: unknown) => (typeof v === 'string' && v.length > 0 ? v : null);

/** Reads id/type from the body, falling back to the FullStackRx-Event-* headers. */
export function indexEvent(body: unknown, headers: { get(name: string): string | null }): IndexedEventFields {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const data = (b.data && typeof b.data === 'object' ? b.data : {}) as Record<string, unknown>;
  const createdAt = str(b.createdAt);
  return {
    event_id: str(b.id) ?? headers.get('fullstackrx-event-id'),
    event_type: str(b.type) ?? headers.get('fullstackrx-event-type'),
    event_created_at: createdAt && !Number.isNaN(Date.parse(createdAt)) ? createdAt : null,
    livemode: typeof b.livemode === 'boolean' ? b.livemode : null,
    fsrx_order_id: str(data.orderId),
    partner_order_id: str(data.partnerOrderId),
    item_id: str(data.itemId),
  };
}

export interface TimelineEvent {
  event_id: string | null;
  event_created_at: string | null;
  received_at: string;
}

/**
 * Dedupes on event id (keeping the first delivery) and orders by the event's own
 * createdAt, since FullStackRx doesn't guarantee delivery order. Events with no
 * createdAt sort last, by when they arrived.
 */
export function buildTimeline<T extends TimelineEvent>(events: T[]): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const e of [...events].sort((a, b) => a.received_at.localeCompare(b.received_at))) {
    if (e.event_id) {
      if (seen.has(e.event_id)) continue;
      seen.add(e.event_id);
    }
    unique.push(e);
  }
  const at = (e: T) => (e.event_created_at ? Date.parse(e.event_created_at) : Number.POSITIVE_INFINITY);
  return unique.sort((a, b) => at(a) - at(b) || a.received_at.localeCompare(b.received_at));
}
