// What the client may send before and after eligibility (spec 2 Amendment 1 C4; #90),
// and the operational metrics sender that applies it (#108).

import { describe, expect, it } from 'vitest';

import {
  type MetricEvent,
  type MetricsSink,
  METRICS,
  TEEN_METRICS,
  createMetricsSender,
  metricEvent,
  metricPermitted,
  serverMetricEvents,
} from './metrics';
import type { AccountGate } from './service';

const accountId = 'account-1';
const ALWAYS = ['eligibility', 'security', 'recovery'] as const;

describe('before eligibility is established', () => {
  const gates: AccountGate[] = [
    { state: 'no-account' },
    { state: 'age-unresolved', accountId, reason: 'check-pending' },
    { state: 'age-ineligible', accountId },
    { state: 'recovery-needed', accountId },
  ];
  it.each(gates)('$state sends only eligibility, security and recovery metrics', (gate) => {
    for (const purpose of ALWAYS) expect(metricPermitted(gate, purpose)).toBe(true);
    expect(metricPermitted(gate, 'operational')).toBe(false);
    expect(metricPermitted(gate, 'product-analytics')).toBe(false);
  });
});

describe('once eligibility is established', () => {
  it('a teen gets operational metrics but never product analytics', () => {
    for (const eligibility of ['13-15', '16-17'] as const) {
      const gate: AccountGate = { state: 'active', accountId, eligibility };
      expect(metricPermitted(gate, 'operational')).toBe(true);
      expect(metricPermitted(gate, 'product-analytics')).toBe(false);
    }
  });

  it('an adult may have product analytics too (still subject to their opt-in)', () => {
    expect(metricPermitted({ state: 'renewal-pending', accountId, eligibility: '18+' }, 'product-analytics')).toBe(true);
  });
});

/** A sink that keeps what it was given. */
function memorySink(): MetricsSink & { readonly events: MetricEvent[] } {
  const events: MetricEvent[] = [];
  return { events, send: (event) => void events.push(event) };
}

function sender(initial: AccountGate) {
  const sink = memorySink();
  let gate = initial;
  const metrics = createMetricsSender({ gate: () => gate, sink });
  return { sink, metrics, setGate: (next: AccountGate) => (gate = next) };
}

const adult: AccountGate = { state: 'active', accountId, eligibility: '18+' };

describe('the operational metrics sender', () => {
  it('sends a device metric as its name, a value and enumerated properties only: no account, installation or analytics identity', () => {
    const { sink, metrics } = sender(adult);
    expect(metrics.record('sync_run_failed', 1, { error: 'offline' })).toBe(true);
    expect(sink.events).toEqual([{ name: 'sync_run_failed', value: 1, properties: { error: 'offline' } }]);
    expect(JSON.stringify(sink.events)).not.toContain(accountId);
  });

  it('sends nothing operational before eligibility is established, and starts once it is', () => {
    const { sink, metrics, setGate } = sender({ state: 'no-account' });
    for (const gate of [
      { state: 'no-account' },
      { state: 'age-unresolved', accountId, reason: 'check-pending' },
      { state: 'age-ineligible', accountId },
      { state: 'recovery-needed', accountId },
      { state: 'signed-out', accountId },
      { state: 'database-unavailable', accountId, reason: 'needs-update' },
    ] as AccountGate[]) {
      setGate(gate);
      expect(metrics.record('sync_queue_age', 5_000, {})).toBe(false);
    }
    expect(sink.events).toEqual([]);
    setGate(adult);
    expect(metrics.record('sync_queue_age', 5_000, {})).toBe(true);
  });

  it('sends a teen device only the permitted list, each with its qualified purpose', () => {
    expect(Object.keys(TEEN_METRICS).sort()).toEqual(['bootstrap_duration', 'sync_queue_age', 'sync_run_failed', 'sync_upload_failed']);
    for (const purpose of Object.values(TEEN_METRICS)) expect(purpose.length).toBeGreaterThan(20);
    for (const eligibility of ['13-15', '16-17'] as const) {
      const { sink, metrics } = sender({ state: 'active', accountId, eligibility });
      expect(metrics.record('sync_upload_failed', 1, { outcome: 'flagged' })).toBe(true);
      expect(sink.events).toHaveLength(1);
    }
  });

  it('never sends a server-side metric from a device', () => {
    const { sink, metrics } = sender(adult);
    expect(metrics.record('email_sends_failed' as never, 1, { type: 'code' } as never)).toBe(false);
    expect(sink.events).toEqual([]);
  });

  it('refuses a name, property or value outside the catalog: free text never reaches the sink', () => {
    const { sink, metrics } = sender(adult);
    expect(metrics.record('casino_session_saved' as never, 1, {} as never)).toBe(false);
    expect(metrics.record('sync_run_failed', 1, { error: 'player@example.com' as never })).toBe(false);
    expect(metrics.record('sync_run_failed', 1, { error: 'offline', record: 'casino-session' } as never)).toBe(false);
    expect(metrics.record('sync_run_failed', 1, {} as never)).toBe(false);
    expect(sink.events).toEqual([]);
  });

  it('rounds values to two significant figures and refuses ones no metric of the unit can take, such as a clock anchor', () => {
    const { sink, metrics } = sender(adult);
    expect(metrics.record('sync_queue_age', 123_456, {})).toBe(true);
    expect(sink.events.at(-1)?.value).toBe(120_000);
    // A time of day in milliseconds since the epoch is no duration.
    expect(metrics.record('sync_queue_age', 1_763_164_800_000, {})).toBe(false);
    expect(metrics.record('sync_queue_age', -1, {})).toBe(false);
    expect(metrics.record('sync_queue_age', Number.NaN, {})).toBe(false);
    expect(metrics.record('sync_run_failed', 1.5, { error: 'offline' })).toBe(false);
    expect(sink.events).toHaveLength(1);
  });

  it('keeps going when the sink throws: a metric never breaks what it measures', () => {
    const metrics = createMetricsSender({
      gate: () => adult,
      sink: {
        send: () => {
          throw new Error('provider down');
        },
      },
    });
    expect(metrics.record('sync_queue_age', 1, {})).toBe(false);
  });
});

describe('the catalog', () => {
  // Words naming what never goes to analytics, logs or crash reports (spec 2,
  // *Observability*; Amendment 5 §6): no property or value of any metric, the
  // device's, the server's or spec 5's billing metrics, may name one.
  const PRIVATE = new Set([
    'token', 'receipt', 'evidence', 'purchase', 'grant', 'anchor', 'clock', 'response', 'ad', 'email', 'address', 'installation',
    'device', 'user', 'id', 'age', 'birth', 'body', 'payload', 'casino', 'strategy', 'otp', 'name', 'ip',
  ]);
  const words = (text: string) => text.toLowerCase().split(/[^a-z]+/).map((word) => word.replace(/s$/, ''));

  it('names nothing private in any property or value', () => {
    for (const [name, definition] of Object.entries(METRICS)) {
      for (const [key, values] of Object.entries(definition.properties)) {
        for (const word of [...words(key), ...values.flatMap(words)]) expect(PRIVATE.has(word), `${name}.${key}: ${word}`).toBe(false);
      }
    }
  });

  it("holds spec 5's billing metrics, server-side under the same rules", () => {
    const billing = Object.entries(METRICS).filter(([name]) => name.startsWith('billing_'));
    expect(billing.map(([name]) => name).sort()).toEqual([
      'billing_ownership_mismatches',
      'billing_pending_activations',
      'billing_queue_lag',
      'billing_reconciliation_coverage',
      'billing_verification_age',
      'billing_verification_failures',
    ]);
    for (const [, definition] of billing) expect(definition.source).toBe('server');
  });

  it('builds a server metric event under the same rules as a device one', () => {
    expect(metricEvent('email_delivery_problems', 3, { type: 'code', problem: 'bounced' })).toEqual({
      name: 'email_delivery_problems',
      value: 3,
      properties: { type: 'code', problem: 'bounced' },
    });
    expect(metricEvent('billing_reconciliation_coverage', 0.987, {})?.value).toBe(0.99);
    expect(metricEvent('billing_reconciliation_coverage', 1.5, {})).toBeNull();
    expect(metricEvent('email_delivery_problems', 3, { type: 'player@example.com', problem: 'bounced' } as never)).toBeNull();
  });
});

describe("the backend's snapshot", () => {
  const snapshot = {
    sync_receipts_refused: 2,
    staged_chunks_age_ms: 61_234,
    storage_bytes: { database: 12_345_678, 'staged-chunks': 0, objects: 4_096 },
    email_sends_failed: { code: 1, 'no-account': 0 },
    email_delivery_problems: { code: { bounced: 3, complained: 0 }, 'no-account': { bounced: 0, complained: 1 } },
    email_queue_age_ms: null,
  };

  it('becomes catalog events: a count, age or size each, with nothing for a queue that is empty or absent', () => {
    expect(serverMetricEvents(snapshot)).toEqual([
      { name: 'sync_receipts_refused', value: 2, properties: {} },
      { name: 'staged_chunks_age', value: 61_000, properties: {} },
      { name: 'storage_bytes', value: 12_000_000, properties: { area: 'database' } },
      { name: 'storage_bytes', value: 0, properties: { area: 'staged-chunks' } },
      { name: 'storage_bytes', value: 4_100, properties: { area: 'objects' } },
      { name: 'email_sends_failed', value: 1, properties: { type: 'code' } },
      { name: 'email_sends_failed', value: 0, properties: { type: 'no-account' } },
      { name: 'email_delivery_problems', value: 3, properties: { type: 'code', problem: 'bounced' } },
      { name: 'email_delivery_problems', value: 0, properties: { type: 'code', problem: 'complained' } },
      { name: 'email_delivery_problems', value: 0, properties: { type: 'no-account', problem: 'bounced' } },
      { name: 'email_delivery_problems', value: 1, properties: { type: 'no-account', problem: 'complained' } },
    ]);
  });

  it('drops anything the catalog does not hold', () => {
    const events = serverMetricEvents({ ...snapshot, email_sends_failed: { code: 1, 'player@example.com': 4 }, extra: 'secret' } as never);
    expect(JSON.stringify(events)).not.toMatch(/player@example\.com|secret/);
  });
});
