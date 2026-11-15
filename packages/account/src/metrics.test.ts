// What the client may send before and after eligibility (spec 2 Amendment 1 C4; #90).

import { describe, expect, it } from 'vitest';

import { metricPermitted } from './metrics';
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
