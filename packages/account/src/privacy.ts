// Spec 2 Amendment 8 §1; #105

import { metricPermitted } from './metrics';
import {
  type AcceptedPrivacyChange,
  type AdDataOptOutSource,
  type AnalyticsConsent,
  type EnablingChange,
  type RestrictiveChange,
  isAcceptedChange,
  isRestrictiveChange,
  privacyChoice,
} from './privacy-record';
import { type AccountGate, type QueueResult, opensOrdinaryAccess } from './service';
import type { SyncEngine } from './sync/engine';
import type { AcceptedRecord, SyncStore } from './sync/store';

export interface PrivacyChoices {
  readonly analytics: {
    readonly consent: AnalyticsConsent;
    readonly generation: number;
    readonly analyticsId: string | null;
  };
  readonly adDataOptOut: { readonly source: AdDataOptOutSource } | null;
  readonly pending: boolean;
  readonly basis: number;
}

export function choicesFrom(accepted: readonly AcceptedRecord[], unsent: readonly unknown[]): PrivacyChoices {
  let consent: AnalyticsConsent = 'never-granted';
  let generation = 0;
  let analyticsId: string | null = null;
  let adDataOptOut: { source: AdDataOptOutSource } | null = null;
  let basis = 0;
  const apply = (change: AcceptedPrivacyChange) => {
    switch (change.change) {
      case 'snapshot':
        consent = change.consent;
        generation = change.generation;
        analyticsId = change.analyticsId;
        adDataOptOut = change.adDataOptOut === null ? null : { source: change.adDataOptOut };
        break;
      case 'grant-analytics':
        consent = 'granted';
        generation = change.generation;
        analyticsId = change.analyticsId;
        break;
      case 'withdraw-analytics':
        if (consent === 'granted') consent = 'withdrawn';
        analyticsId = null;
        break;
      case 'limit-ad-data':
        adDataOptOut = { source: change.source };
        break;
      case 'allow-ad-data':
        adDataOptOut = null;
        break;
    }
  };
  for (const record of [...accepted].sort((a, b) => a.sequence - b.sequence)) {
    if (!isAcceptedChange(record.payload)) continue;
    apply(record.payload);
    basis = Math.max(basis, record.sequence);
  }
  const restrictive = unsent.filter(isRestrictiveChange);
  restrictive.forEach(apply);
  return { analytics: { consent, generation, analyticsId }, adDataOptOut, pending: restrictive.length > 0, basis };
}

export function productAnalyticsId(gate: AccountGate, choices: PrivacyChoices | null): string | null {
  if (!metricPermitted(gate, 'product-analytics')) return null;
  return choices?.analytics.consent === 'granted' ? choices.analytics.analyticsId : null;
}

export type RestrictiveResult = { readonly status: 'applied' } | { readonly status: 'unavailable' };

export type EnablingResult = {
  readonly status: 'changed' | 'unchanged' | 'not-eligible' | 'stale' | 'waiting' | 'offline' | 'incompatible' | 'unavailable' | 'failed';
};

export interface AccountPrivacy {
  read(): Promise<PrivacyChoices | null>;
  withdrawAnalytics(): Promise<RestrictiveResult>;
  limitAdData(): Promise<RestrictiveResult>;
  grantAnalytics(): Promise<EnablingResult>;
  allowAdData(): Promise<EnablingResult>;
}

export interface PrivacyPorts {
  session(): { readonly store: SyncStore; readonly engine: SyncEngine } | null;
  queue(recordType: string, payload: unknown): Promise<QueueResult>;
  readonly gate: () => AccountGate;
  newChoiceId(): string;
}

export function accountPrivacy(ports: PrivacyPorts): AccountPrivacy {
  const read = async (): Promise<PrivacyChoices | null> => {
    const session = ports.session();
    if (!session) return null;
    const { store } = session;
    try {
      const [accepted, queue, rejected] = await Promise.all([
        store.readAcceptedRecords(privacyChoice.name),
        store.readUploadQueue(),
        store.readRejectedUploads(),
      ]);
      const unsent = [...queue, ...rejected].filter((entry) => entry.recordType === privacyChoice.name).map((entry) => entry.payload);
      return choicesFrom(accepted, unsent);
    } catch {
      return null;
    }
  };

  const restrict = async (change: RestrictiveChange): Promise<RestrictiveResult> => {
    const queued = await ports.queue(privacyChoice.name, change);
    return { status: queued.status === 'queued' ? 'applied' : 'unavailable' };
  };

  let unanswered: { readonly session: object; readonly change: EnablingChange } | null = null;

  const enable = async (change: EnablingChange['change'], already: (choices: PrivacyChoices) => boolean): Promise<EnablingResult> => {
    const session = ports.session();
    if (!session) return { status: 'unavailable' };
    await session.engine.reconcile();
    const choices = await read();
    if (!choices || ports.session() !== session) return { status: 'unavailable' };
    if (choices.pending) return { status: 'waiting' };
    if (already(choices)) return { status: 'unchanged' };
    const earlier = unanswered?.session === session && unanswered.change.change === change && unanswered.change.basis === choices.basis ? unanswered.change : null;
    const payload: EnablingChange = earlier ?? { version: 1, choiceId: ports.newChoiceId(), change, basis: choices.basis };
    const outcome = await session.engine.submit(privacyChoice.name, payload);
    unanswered = outcome.status === 'offline' ? { session, change: payload } : null;
    switch (outcome.status) {
      case 'accepted':
        return { status: 'changed' };
      case 'rejected':
        return { status: outcome.code === 'stale' || outcome.code === 'unchanged' || outcome.code === 'not-eligible' ? outcome.code : 'failed' };
      case 'invalid':
        return { status: 'failed' };
      default:
        return { status: outcome.status };
    }
  };

  return {
    read,
    withdrawAnalytics: () => restrict({ version: 1, choiceId: ports.newChoiceId(), change: 'withdraw-analytics' }),
    limitAdData: () => restrict({ version: 1, choiceId: ports.newChoiceId(), change: 'limit-ad-data', source: 'in-app' }),
    async grantAnalytics() {
      const gate = ports.gate();
      if (opensOrdinaryAccess(gate) && gate.eligibility !== '18+') return { status: 'not-eligible' };
      return enable('grant-analytics', (choices) => choices.analytics.consent === 'granted');
    },
    allowAdData: () => enable('allow-ad-data', (choices) => choices.adDataOptOut === null),
  };
}
