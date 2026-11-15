// Operational metrics and the privacy boundary (spec 2, *Observability and
// privacy boundaries*; Amendment 1 C4, Amendment 5 §6; #108).
//
// What the client may send, by purpose, given the account gate: before
// eligibility is established, only what eligibility, security and recovery
// need. Every metric is in one catalog, and an event is only its name, a
// number and enumerated properties: no free text, no identity (account,
// installation or analytics ID), so no record body, token, email code, raw age
// data, clock anchor, account email or casino session can ride along. A teen's
// device sends only TEEN_METRICS, each with its qualified purpose. Spec 5's
// billing metrics are here under the same rules.
//
// Operational metrics carry no analytics ID, so they don't depend on the
// privacy choices record (#105); product analytics, which do and need the
// adult's opt-in, are spec 7's and aren't in this catalog. The provider
// (PostHog) is spec 7's too: it sits behind MetricsSink.

import type { SyncErrorCode } from './sync/engine';
import { type AccountGate, opensOrdinaryAccess } from './service';

export type MetricPurpose = 'eligibility' | 'security' | 'recovery' | 'operational' | 'product-analytics';

const BEFORE_ELIGIBILITY: ReadonlySet<MetricPurpose> = new Set(['eligibility', 'security', 'recovery']);

/** Whether the gate lets the client send a metric or event of this purpose. */
export function metricPermitted(gate: AccountGate, purpose: MetricPurpose): boolean {
  if (BEFORE_ELIGIBILITY.has(purpose)) return true;
  if (!opensOrdinaryAccess(gate)) return false;
  // No optional product analytics for teens (spec 7); adults still need their opt-in (#105).
  return purpose !== 'product-analytics' || gate.eligibility === '18+';
}

/**
 * What a value measures, and the largest it can be. A larger count, size or
 * ratio is refused; a longer age reports the cap, so a stuck queue still shows
 * and a clock anchor (milliseconds since the epoch) never leaves.
 */
const UNITS = {
  count: { max: 1e9, integer: true, capped: false },
  milliseconds: { max: 31 * 24 * 3_600_000, integer: false, capped: true },
  bytes: { max: 1e14, integer: true, capped: false },
  ratio: { max: 1, integer: false, capped: false },
} as const;

interface MetricDefinition {
  readonly purpose: MetricPurpose;
  /** device: sent by the app, under the gate. server: an aggregate over every account, from the backend. */
  readonly source: 'device' | 'server';
  readonly unit: keyof typeof UNITS;
  /** Each property's permitted values. */
  readonly properties: Readonly<Record<string, readonly string[]>>;
  /** A device metric's qualified purpose on a teen's device; absent when a teen's device never sends it. */
  readonly teen?: string;
}

const SYNC_ERRORS = ['offline', 'sign-in-required', 'incompatible', 'unsendable', 'unreadable-change', 'storage'] as const satisfies readonly SyncErrorCode[];
const EMAIL_TYPES = ['code', 'no-account'] as const;
const KEEP_HISTORY = "Find a teen's practice history not reaching their account, so none of it is lost.";

export const METRICS = {
  // The device's sync engine.
  /** A sync run ended without finishing: a reconciliation failure, by its structured error code. */
  sync_run_failed: { purpose: 'operational', source: 'device', unit: 'count', properties: { error: SYNC_ERRORS }, teen: KEEP_HISTORY },
  /** One upload failed by itself (failed), reached the flag limit (flagged), or its receipt refused it (refused). */
  sync_upload_failed: { purpose: 'operational', source: 'device', unit: 'count', properties: { outcome: ['failed', 'flagged', 'refused'] }, teen: KEEP_HISTORY },
  /** After a run, how long the oldest upload still pending has waited, as far as this account session has seen. */
  sync_queue_age: { purpose: 'operational', source: 'device', unit: 'milliseconds', properties: {}, teen: KEEP_HISTORY },
  /** A new device's bootstrap (#96), from its start to its baseline installed, or to its failure. */
  bootstrap_duration: {
    purpose: 'operational',
    source: 'device',
    unit: 'milliseconds',
    properties: { outcome: ['complete', 'failed'] },
    teen: "Find slow or failing restores of a teen's history on a new device.",
  },

  // The backend's aggregates (supabase/migrations, *operational_metrics*).
  /** Receipts that refused their upload, in the window. */
  sync_receipts_refused: { purpose: 'operational', source: 'server', unit: 'count', properties: {} },
  /** Database transactions that failed and rolled back, since the database's statistics were last reset (a running total). */
  transactions_rolled_back: { purpose: 'operational', source: 'server', unit: 'count', properties: {} },
  /** How long the oldest staged chunk has waited for its manifest: the upload staging queue's age. */
  staged_chunks_age: { purpose: 'operational', source: 'server', unit: 'milliseconds', properties: {} },
  /** What the backend holds: the database, the chunks staged in it, and storage objects. */
  storage_bytes: { purpose: 'operational', source: 'server', unit: 'bytes', properties: { area: ['database', 'staged-chunks', 'objects'] } },
  /** Emails that couldn't be delivered, in the window. */
  email_sends_failed: { purpose: 'operational', source: 'server', unit: 'count', properties: { type: EMAIL_TYPES } },
  /** Bounces and complaints the mail provider reported, in the window. */
  email_delivery_problems: { purpose: 'operational', source: 'server', unit: 'count', properties: { type: EMAIL_TYPES, problem: ['bounced', 'complained'] } },
  /** How long the oldest email waiting to be sent has waited. Codes never wait; only bulk mail queues. */
  email_queue_age: { purpose: 'operational', source: 'server', unit: 'milliseconds', properties: { pacing: ['bulk'] } },

  // Spec 5's billing metrics (Amendment 5 §6), from its backend.
  billing_verification_age: { purpose: 'operational', source: 'server', unit: 'milliseconds', properties: {} },
  billing_verification_failures: { purpose: 'operational', source: 'server', unit: 'count', properties: {} },
  billing_pending_activations: { purpose: 'operational', source: 'server', unit: 'count', properties: {} },
  billing_ownership_mismatches: { purpose: 'operational', source: 'server', unit: 'count', properties: {} },
  billing_queue_lag: { purpose: 'operational', source: 'server', unit: 'milliseconds', properties: {} },
  billing_reconciliation_coverage: { purpose: 'operational', source: 'server', unit: 'ratio', properties: {} },
} as const satisfies Record<string, MetricDefinition>;

export type MetricName = keyof typeof METRICS;
type Catalog = typeof METRICS;
export type DeviceMetricName = { [N in MetricName]: Catalog[N]['source'] extends 'device' ? N : never }[MetricName];
export type ServerMetricName = Exclude<MetricName, DeviceMetricName>;
/** A metric's properties: each one of its permitted values. */
export type MetricProperties<N extends MetricName> = {
  readonly [K in keyof Catalog[N]['properties']]: Catalog[N]['properties'][K] extends readonly (infer V)[] ? V : never;
};

/** The metrics a teen's device sends, each with its qualified purpose (Amendment 1 C4). Nothing else leaves it. */
export const TEEN_METRICS: Readonly<Partial<Record<DeviceMetricName, string>>> = Object.fromEntries(
  Object.entries(METRICS as Record<string, MetricDefinition>).flatMap(([name, { teen }]) => (teen ? [[name, teen]] : [])),
);

/** What goes to the provider: nothing else. */
export interface MetricEvent {
  readonly name: MetricName;
  readonly value: number;
  readonly properties: Readonly<Record<string, string>>;
}

/** The metrics provider (spec 7). It adds no identity to an operational event. */
export interface MetricsSink {
  send(event: MetricEvent): void;
}

/** Discards every event: the provider until spec 7 wires one. */
export const discardMetrics: MetricsSink = { send: () => undefined };

/**
 * The event for a metric, or null when the catalog doesn't allow it: an
 * unknown name, a property it doesn't have (or lacks one), a value outside
 * its list, or a number outside its unit. Values keep two significant figures.
 */
export function metricEvent<N extends MetricName>(name: N, value: number, properties: MetricProperties<N>): MetricEvent | null {
  const definition = definitionOf(name);
  if (!definition) return null;
  const unit = UNITS[definition.unit];
  if (!Number.isFinite(value) || value < 0 || (unit.integer && !Number.isInteger(value))) return null;
  if (value > unit.max && !unit.capped) return null;
  const given = Object.entries(properties as Record<string, unknown>);
  const expected = Object.keys(definition.properties);
  if (given.length !== expected.length) return null;
  for (const [key, property] of given) {
    const values = Object.hasOwn(definition.properties, key) ? definition.properties[key] : undefined;
    if (!values || typeof property !== 'string' || !values.includes(property)) return null;
  }
  return { name, value: Math.min(Number(value.toPrecision(2)), unit.max), properties: Object.fromEntries(given) as Record<string, string> };
}

function definitionOf(name: string): MetricDefinition | undefined {
  return Object.hasOwn(METRICS, name) ? (METRICS as Record<string, MetricDefinition>)[name] : undefined;
}

export interface MetricsSender {
  /** Sends a device metric when the gate and the catalog allow it; true when it went to the sink. */
  record<N extends DeviceMetricName>(name: N, value: number, properties: MetricProperties<N>): boolean;
}

/** The device's sender: every device metric goes through it, under the account gate as it is when the metric is recorded. */
export function createMetricsSender({ gate, sink }: { readonly gate: () => AccountGate; readonly sink: MetricsSink }): MetricsSender {
  return {
    record(name, value, properties) {
      const definition = definitionOf(name);
      if (definition?.source !== 'device') return false;
      const current = gate();
      if (!metricPermitted(current, definition.purpose)) return false;
      if (opensOrdinaryAccess(current) && current.eligibility !== '18+' && !definition.teen) return false;
      const event = metricEvent(name, value, properties);
      if (!event) return false;
      try {
        sink.send(event);
        return true;
      } catch {
        // A metric never breaks what it measures.
        return false;
      }
    },
  };
}

/** The backend's snapshot (`public.operational_metrics`): aggregates over every account. */
export interface OperationalSnapshot {
  readonly sync_receipts_refused: number;
  readonly transactions_rolled_back: number;
  readonly staged_chunks_age_ms: number | null;
  readonly storage_bytes: Readonly<Record<'database' | 'staged-chunks' | 'objects', number>>;
  readonly email_sends_failed: Readonly<Record<(typeof EMAIL_TYPES)[number], number>>;
  readonly email_delivery_problems: Readonly<Record<(typeof EMAIL_TYPES)[number], Readonly<Record<'bounced' | 'complained', number>>>>;
  readonly email_queue_age_ms: number | null;
}

/** The snapshot as catalog events, for the provider. Only what the catalog holds survives: anything else is dropped. */
export function serverMetricEvents(snapshot: OperationalSnapshot): MetricEvent[] {
  const events: (MetricEvent | null)[] = [
    metricEvent('sync_receipts_refused', snapshot.sync_receipts_refused, {}),
    metricEvent('transactions_rolled_back', snapshot.transactions_rolled_back, {}),
  ];
  if (snapshot.staged_chunks_age_ms !== null) events.push(metricEvent('staged_chunks_age', snapshot.staged_chunks_age_ms, {}));
  for (const [area, bytes] of Object.entries(snapshot.storage_bytes)) events.push(metricEvent('storage_bytes', bytes, { area } as never));
  for (const [type, count] of Object.entries(snapshot.email_sends_failed)) events.push(metricEvent('email_sends_failed', count, { type } as never));
  for (const [type, problems] of Object.entries(snapshot.email_delivery_problems)) {
    for (const [problem, count] of Object.entries(problems)) events.push(metricEvent('email_delivery_problems', count, { type, problem } as never));
  }
  if (snapshot.email_queue_age_ms !== null) events.push(metricEvent('email_queue_age', snapshot.email_queue_age_ms, { pacing: 'bulk' }));
  return events.filter((event): event is MetricEvent => event !== null);
}
