// Spec 2 Amendment 8 §1; #105

import { describe, expect, it } from 'vitest';

import { type PrivacyChoices, choicesFrom, productAnalyticsId } from './privacy';
import type { AccountGate } from './service';
import type { AcceptedRecord } from './sync/store';

const accepted = (sequence: number, change: Record<string, unknown>): AcceptedRecord => ({
  recordType: 'privacy-choice',
  item: `choice-${sequence}`,
  sequence,
  payload: { version: 1, choiceId: `choice-${sequence}`, ...change },
});
const ID_1 = 'a'.repeat(32);
const ID_2 = 'b'.repeat(32);

describe('privacy choices', () => {
  it('start with analytics never granted and ad data not limited', () => {
    expect(choicesFrom([], [])).toEqual<PrivacyChoices>({
      analytics: { consent: 'never-granted', generation: 0, analyticsId: null },
      adDataOptOut: null,
      pending: false,
      basis: 0,
    });
  });

  it('give each grant its own generation and analytics ID', () => {
    const choices = choicesFrom(
      [
        accepted(3, { change: 'grant-analytics', generation: 1, analyticsId: ID_1 }),
        accepted(7, { change: 'withdraw-analytics' }),
        accepted(9, { change: 'grant-analytics', generation: 2, analyticsId: ID_2 }),
      ],
      [],
    );
    expect(choices.analytics).toEqual({ consent: 'granted', generation: 2, analyticsId: ID_2 });
    expect(choices.basis).toBe(9);
  });

  it('show no analytics ID once consent is withdrawn', () => {
    const choices = choicesFrom(
      [accepted(3, { change: 'grant-analytics', generation: 1, analyticsId: ID_1 }), accepted(4, { change: 'withdraw-analytics' })],
      [],
    );
    expect(choices.analytics).toEqual({ consent: 'withdrawn', generation: 1, analyticsId: null });
  });

  it('keep a withdrawal of consent never granted as never granted', () => {
    expect(choicesFrom([accepted(2, { change: 'withdraw-analytics' })], []).analytics.consent).toBe('never-granted');
  });

  it('hold the ad-data opt-out with its latest source until it is allowed again', () => {
    expect(choicesFrom([accepted(1, { change: 'limit-ad-data', source: 'gpc' })], []).adDataOptOut).toEqual({ source: 'gpc' });
    expect(
      choicesFrom([accepted(1, { change: 'limit-ad-data', source: 'gpc' }), accepted(2, { change: 'limit-ad-data', source: 'support' })], [])
        .adDataOptOut,
    ).toEqual({ source: 'support' });
    expect(choicesFrom([accepted(1, { change: 'limit-ad-data', source: 'in-app' }), accepted(5, { change: 'allow-ad-data' })], []).adDataOptOut).toBeNull();
  });

  it('apply this installation’s unsent withdrawal and opt-out at once, over what the account accepted', () => {
    const choices = choicesFrom(
      [accepted(3, { change: 'grant-analytics', generation: 1, analyticsId: ID_1 })],
      [
        { version: 1, choiceId: '1'.repeat(32), change: 'withdraw-analytics' },
        { version: 1, choiceId: '2'.repeat(32), change: 'limit-ad-data', source: 'in-app' },
      ],
    );
    expect(choices).toMatchObject({
      analytics: { consent: 'withdrawn', generation: 1, analyticsId: null },
      adDataOptOut: { source: 'in-app' },
      pending: true,
      basis: 3,
    });
  });

  it('start from a bootstrap snapshot’s current choices, at its sequence, then apply later changes', () => {
    const snapshot: AcceptedRecord = {
      recordType: 'privacy-choice',
      item: 'current',
      sequence: 12,
      payload: { version: 1, change: 'snapshot', consent: 'granted', generation: 2, analyticsId: ID_2, adDataOptOut: 'gpc' },
    };
    expect(choicesFrom([snapshot], [])).toEqual<PrivacyChoices>({
      analytics: { consent: 'granted', generation: 2, analyticsId: ID_2 },
      adDataOptOut: { source: 'gpc' },
      pending: false,
      basis: 12,
    });
    const later = choicesFrom([snapshot, accepted(14, { change: 'withdraw-analytics' }), accepted(15, { change: 'allow-ad-data' })], []);
    expect(later).toMatchObject({ analytics: { consent: 'withdrawn', generation: 2, analyticsId: null }, adDataOptOut: null, basis: 15 });
    const withdrawn = { ...snapshot, payload: { version: 1, change: 'snapshot', consent: 'withdrawn', generation: 2, analyticsId: null, adDataOptOut: null } };
    expect(choicesFrom([withdrawn], []).analytics).toEqual({ consent: 'withdrawn', generation: 2, analyticsId: null });
  });

  it('read no snapshot whose analytics ID doesn’t match its consent', () => {
    const snapshot = (consent: string, analyticsId: string | null): AcceptedRecord => ({
      recordType: 'privacy-choice',
      item: 'current',
      sequence: 3,
      payload: { version: 1, change: 'snapshot', consent, generation: 1, analyticsId, adDataOptOut: null },
    });
    expect(choicesFrom([snapshot('granted', null)], []).basis).toBe(0);
    expect(choicesFrom([snapshot('withdrawn', ID_1)], []).basis).toBe(0);
  });

  it('ignore records that aren’t privacy changes', () => {
    expect(choicesFrom([accepted(1, { change: 'grant-analytics', generation: 1, analyticsId: 'not-hex' })], [{ note: 1 }]).analytics.consent).toBe(
      'never-granted',
    );
  });
});

describe('the analytics ID product analytics may use', () => {
  const granted = choicesFrom([accepted(3, { change: 'grant-analytics', generation: 1, analyticsId: ID_1 })], []);
  const adult: AccountGate = { state: 'active', accountId: 'account', eligibility: '18+' };

  it('is the current generation’s for an open adult account that granted consent', () => {
    expect(productAnalyticsId(adult, granted)).toBe(ID_1);
    expect(productAnalyticsId({ state: 'renewal-pending', accountId: 'account', eligibility: '18+' }, granted)).toBe(ID_1);
  });

  it('is none once a withdrawal is made here, before it reaches the account', () => {
    const withdrawing = choicesFrom(
      [accepted(3, { change: 'grant-analytics', generation: 1, analyticsId: ID_1 })],
      [{ version: 1, choiceId: '1'.repeat(32), change: 'withdraw-analytics' }],
    );
    expect(productAnalyticsId(adult, withdrawing)).toBeNull();
  });

  it.each<AccountGate>([
    { state: 'active', accountId: 'account', eligibility: '16-17' },
    { state: 'active', accountId: 'account', eligibility: '13-15' },
    { state: 'age-unresolved', accountId: 'account', reason: 'not-established' },
    { state: 'signed-out', accountId: 'account' },
    { state: 'no-account' },
  ])('is none for a gate that isn’t an open adult account ($state)', (gate) => {
    expect(productAnalyticsId(gate, granted)).toBeNull();
  });

  it('is none without consent or without choices', () => {
    expect(productAnalyticsId(adult, choicesFrom([], []))).toBeNull();
    expect(productAnalyticsId(adult, null)).toBeNull();
  });
});
