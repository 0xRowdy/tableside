// Privacy choices (spec 2 Amendment 8 §1, #105): the account-state record
// that spec 7's analytics and ad-data controls, support and the web account
// page write to. It holds the analytics consent and its generation, one random
// analytics ID per generation (never the account ID or email), and the
// ad-data opt-out ("Limit ad data") with its source.
//
// - Restrictive changes (withdrawing consent, limiting ad data) apply on this
//   installation at once, offline too: they are queued, and every reader sees
//   them before they reach the account. Each always applies to the account's
//   current state when it arrives, so one made offline on another device still
//   withdraws a consent granted since: a late consent withdrawal fails closed.
// - Enabling changes (granting consent, allowing ad data again) are online
//   only and never queued. They wait for this installation's pending
//   restrictive changes (the barrier), name the account's last privacy change
//   they were made from (`basis`), and the server refuses them as stale when
//   the account's choices changed since. So a stale device can't re-enable a
//   withdrawn choice or clear an opt-out. Each grant starts a new generation,
//   whose analytics ID the server draws at random.
// - The server grants consent only for an established adult account: never a
//   teen, an unresolved account or one before eligibility.
//
// Every change is its own item, so this installation keeps each one the
// account accepted, and the choices are those changes in account order. A
// new device therefore needs every accepted privacy change: bootstrap (#96)
// and feed compaction (#43) must carry them all, or its choices and basis
// would be wrong (and every enabling change it sent, stale).

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

/** The account's privacy choices as this installation applies them. */
export interface PrivacyChoices {
  readonly analytics: {
    readonly consent: AnalyticsConsent;
    /** The latest consent generation: 0 until the first grant. */
    readonly generation: number;
    /** The current generation's analytics ID while consent is granted; otherwise null. */
    readonly analyticsId: string | null;
  };
  /** Every analytics ID the account has had, oldest first: what export lists and deletion erases. */
  readonly analyticsIds: readonly { readonly generation: number; readonly analyticsId: string }[];
  /** The ad-data opt-out, or null when ad data isn't limited. */
  readonly adDataOptOut: { readonly source: AdDataOptOutSource } | null;
  /** A consent withdrawal or ad-data opt-out made on this installation hasn't reached the account yet. */
  readonly pending: boolean;
  /** The account sequence of the last privacy change this installation holds: what an enabling change is made from. */
  readonly basis: number;
}


/**
 * The choices from the account's accepted changes (in account order) and this
 * installation's restrictive changes that haven't reached it (queued, or
 * refused and kept for review: withdrawn consent never quietly comes back).
 */
export function choicesFrom(accepted: readonly AcceptedRecord[], unsent: readonly unknown[]): PrivacyChoices {
  let consent: AnalyticsConsent = 'never-granted';
  let generation = 0;
  let analyticsId: string | null = null;
  const analyticsIds: { generation: number; analyticsId: string }[] = [];
  let adDataOptOut: { source: AdDataOptOutSource } | null = null;
  let basis = 0;
  const apply = (change: AcceptedPrivacyChange) => {
    switch (change.change) {
      case 'grant-analytics':
        consent = 'granted';
        generation = change.generation;
        analyticsId = change.analyticsId;
        analyticsIds.push({ generation: change.generation, analyticsId: change.analyticsId });
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
  return { analytics: { consent, generation, analyticsId }, analyticsIds, adDataOptOut, pending: restrictive.length > 0, basis };
}

/**
 * The analytics ID optional product analytics may be sent under now, or null
 * when none may be: only for an open, established adult account whose consent
 * is granted on this installation (withdrawing it here applies at once).
 * Spec 7's analytics port tags events with it; the privacy boundary (#108)
 * decides which events those are.
 */
export function productAnalyticsId(gate: AccountGate, choices: PrivacyChoices | null): string | null {
  if (!metricPermitted(gate, 'product-analytics')) return null;
  return choices?.analytics.consent === 'granted' ? choices.analytics.analyticsId : null;
}

/** A restrictive change: applied on this installation (and queued), or unavailable with no account session syncing. */
export type RestrictiveResult = { readonly status: 'applied' } | { readonly status: 'unavailable' };

/**
 * An enabling change. changed: the account accepted it. unchanged: the
 * account already had it. not-eligible: only an established adult may grant
 * consent. stale: the account's choices changed since this installation last
 * heard; it now holds them, to ask again. waiting: a consent withdrawal or opt-out
 * made here hasn't reached the account yet, and nothing was sent. offline: no
 * answer arrived. incompatible: an update is required. unavailable: no account
 * session is syncing. failed: the server refused it otherwise.
 */
export type EnablingResult = {
  readonly status: 'changed' | 'unchanged' | 'not-eligible' | 'stale' | 'waiting' | 'offline' | 'incompatible' | 'unavailable' | 'failed';
};

/** The Account service's privacy choices for the open account session. */
export interface AccountPrivacy {
  /** The choices as this installation applies them, its own unsent restrictive changes included; null with no account session syncing. */
  read(): Promise<PrivacyChoices | null>;
  /** Withdraws analytics consent: at once on this installation, offline too, then on the account. */
  withdrawAnalytics(): Promise<RestrictiveResult>;
  /** Limits ad data (source in-app): at once on this installation, offline too, then on the account. */
  limitAdData(): Promise<RestrictiveResult>;
  /** Grants analytics consent, starting a new generation with a new analytics ID. Online only; established adults only. */
  grantAnalytics(): Promise<EnablingResult>;
  /** Allows ad data again, clearing the opt-out whatever its source. Online only. */
  allowAdData(): Promise<EnablingResult>;
}

export interface PrivacyPorts {
  /** The syncing account session's store and engine, or null. */
  session(): { readonly store: SyncStore; readonly engine: SyncEngine } | null;
  /** Queues an upload, as AccountSync.queue does. */
  queue(recordType: string, payload: unknown): Promise<QueueResult>;
  readonly gate: () => AccountGate;
  /** A fresh random choice ID: 32 lowercase hex digits. */
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
      // The account session ended while reading.
      return null;
    }
  };

  const restrict = async (change: RestrictiveChange): Promise<RestrictiveResult> => {
    const queued = await ports.queue(privacyChoice.name, change);
    return { status: queued.status === 'queued' ? 'applied' : 'unavailable' };
  };

  /**
   * An enabling change sent with no answer yet: asked again in the same
   * account session from the same state, it is the identical change, so the
   * engine repeats the identical request and the account applies it once.
   */
  let unanswered: { readonly session: object; readonly change: EnablingChange } | null = null;

  /** Brings this installation up to date, then sends the enabling change from the account's last privacy change. */
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
      // Never asked of the server for anyone but an established adult; the server refuses them anyway.
      if (opensOrdinaryAccess(gate) && gate.eligibility !== '18+') return { status: 'not-eligible' };
      return enable('grant-analytics', (choices) => choices.analytics.consent === 'granted');
    },
    allowAdData: () => enable('allow-ad-data', (choices) => choices.adDataOptOut === null),
  };
}
