// Spec 2 Observability and privacy boundaries; Amendment 1 C4, Amendment 5 §6; #108

import type { SyncErrorCode } from './sync/engine';
import { type AccountGate, opensOrdinaryAccess } from './service';

export type MetricPurpose = 'eligibility' | 'security' | 'recovery' | 'operational' | 'product-analytics';

const BEFORE_ELIGIBILITY: ReadonlySet<MetricPurpose> = new Set(['eligibility', 'security', 'recovery']);

export function metricPermitted(gate: AccountGate, purpose: MetricPurpose): boolean {
  if (BEFORE_ELIGIBILITY.has(purpose)) return true;
  if (!opensOrdinaryAccess(gate)) return false;
  // Spec 7; #105
  return purpose !== 'product-analytics' || gate.eligibility === '18+';
}

const UNITS = {
  count: { max: 1e9, integer: true, capped: false },
  milliseconds: { max: 31 * 24 * 3_600_000, integer: false, capped: true },
  bytes: { max: 1e14, integer: true, capped: false },
  ratio: { max: 1, integer: false, capped: false },
} as const;

interface MetricDefinition {
  readonly purpose: MetricPurpose;
  readonly source: 'device' | 'server';
  readonly unit: keyof typeof UNITS;
  readonly properties: Readonly<Record<string, readonly string[]>>;
  readonly teen?: string;
}

const SYNC_ERRORS = ['offline', 'sign-in-required', 'incompatible', 'unsendable', 'unreadable-change', 'storage'] as const satisfies readonly SyncErrorCode[];
export const EMAIL_TYPES = ['code', 'no-account', 'method-linked', 'email-change', 'device-revoked', 'export-ready', 'deletion-scheduled', 'deletion-accepted'] as const;
const METRIC_NAMES: Readonly<Record<string, string>> = { 'email-change': 'login-change', 'device-revoked': 'sessions-revoked' };
export const metricEmailType = (type: string): string => METRIC_NAMES[type] ?? type;
const METRIC_EMAIL_TYPES = EMAIL_TYPES.map(metricEmailType);
const KEEP_HISTORY = "Find a teen's practice history not reaching their account, so none of it is lost.";

export const METRICS = {
  sync_run_failed: { purpose: 'operational', source: 'device', unit: 'count', properties: { error: SYNC_ERRORS }, teen: KEEP_HISTORY },
  sync_upload_failed: { purpose: 'operational', source: 'device', unit: 'count', properties: { outcome: ['failed', 'flagged', 'refused', 'unconfirmed'] }, teen: KEEP_HISTORY },
  sync_queue_age: { purpose: 'operational', source: 'device', unit: 'milliseconds', properties: {}, teen: KEEP_HISTORY },
  // #96
  bootstrap_duration: {
    purpose: 'operational',
    source: 'device',
    unit: 'milliseconds',
    properties: { outcome: ['complete', 'failed'] },
    teen: "Find slow or failing restores of a teen's history on a new device.",
  },

  sync_receipts_refused: { purpose: 'operational', source: 'server', unit: 'count', properties: {} },
  transactions_rolled_back: { purpose: 'operational', source: 'server', unit: 'count', properties: {} },
  staged_chunks_age: { purpose: 'operational', source: 'server', unit: 'milliseconds', properties: {} },
  storage_bytes: { purpose: 'operational', source: 'server', unit: 'bytes', properties: { area: ['database', 'staged-chunks', 'objects'] } },
  email_sends_failed: { purpose: 'operational', source: 'server', unit: 'count', properties: { type: METRIC_EMAIL_TYPES } },
  email_delivery_problems: { purpose: 'operational', source: 'server', unit: 'count', properties: { type: METRIC_EMAIL_TYPES, problem: ['bounced', 'complained'] } },
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
export type MetricProperties<N extends MetricName> = {
  readonly [K in keyof Catalog[N]['properties']]: Catalog[N]['properties'][K] extends readonly (infer V)[] ? V : never;
};

// Spec 2 Amendment 1 C4
export const TEEN_METRICS: Readonly<Partial<Record<DeviceMetricName, string>>> = Object.fromEntries(
  Object.entries(METRICS as Record<string, MetricDefinition>).flatMap(([name, { teen }]) => (teen ? [[name, teen]] : [])),
);

export interface MetricEvent {
  readonly name: MetricName;
  readonly value: number;
  readonly properties: Readonly<Record<string, string>>;
}

// Spec 7
export interface MetricsSink {
  send(event: MetricEvent): void;
}

// TODO(spec 7)
export const discardMetrics: MetricsSink = { send: () => undefined };

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
  record<N extends DeviceMetricName>(name: N, value: number, properties: MetricProperties<N>): boolean;
}

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
        return false;
      }
    },
  };
}

export interface OperationalSnapshot {
  readonly sync_receipts_refused: number;
  readonly transactions_rolled_back: number;
  readonly staged_chunks_age_ms: number | null;
  readonly storage_bytes: Readonly<Record<'database' | 'staged-chunks' | 'objects', number>>;
  readonly email_sends_failed: Readonly<Partial<Record<(typeof EMAIL_TYPES)[number], number>>>;
  readonly email_delivery_problems: Readonly<Partial<Record<(typeof EMAIL_TYPES)[number], Readonly<Record<'bounced' | 'complained', number>>>>>;
  readonly email_queue_age_ms: number | null;
}

export function serverMetricEvents(snapshot: OperationalSnapshot): MetricEvent[] {
  const events: (MetricEvent | null)[] = [
    metricEvent('sync_receipts_refused', snapshot.sync_receipts_refused, {}),
    metricEvent('transactions_rolled_back', snapshot.transactions_rolled_back, {}),
  ];
  if (snapshot.staged_chunks_age_ms !== null) events.push(metricEvent('staged_chunks_age', snapshot.staged_chunks_age_ms, {}));
  for (const [area, bytes] of Object.entries(snapshot.storage_bytes)) events.push(metricEvent('storage_bytes', bytes, { area } as never));
  for (const [type, count] of Object.entries(snapshot.email_sends_failed)) {
    events.push(metricEvent('email_sends_failed', count, { type: metricEmailType(type) } as never));
  }
  for (const [type, problems] of Object.entries(snapshot.email_delivery_problems)) {
    for (const [problem, count] of Object.entries(problems)) events.push(metricEvent('email_delivery_problems', count, { type: metricEmailType(type), problem } as never));
  }
  if (snapshot.email_queue_age_ms !== null) events.push(metricEvent('email_queue_age', snapshot.email_queue_age_ms, { pacing: 'bulk' }));
  return events.filter((event): event is MetricEvent => event !== null);
}
