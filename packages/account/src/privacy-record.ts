// The privacy-choices record type (spec 2 Amendment 8 §1, #105): the shapes
// a device uploads and the account accepts, and its registration. The choices
// they make, and the Account service's part, are in privacy.ts. The server
// half is supabase/migrations/20261119083417_privacy_choices.sql.

import type { RecordType } from './sync/registry';

/** never-granted: the account has never granted consent. withdrawn: it granted consent, then withdrew it. */
export type AnalyticsConsent = 'never-granted' | 'granted' | 'withdrawn';

/** Where an ad-data opt-out came from: the app, support, or a browser's Global Privacy Control on the web account page. */
export type AdDataOptOutSource = 'in-app' | 'support' | 'gpc';

/** A restrictive change: queued, so it works offline. */
export type RestrictiveChange =
  | { readonly version: 1; readonly choiceId: string; readonly change: 'withdraw-analytics' }
  | { readonly version: 1; readonly choiceId: string; readonly change: 'limit-ad-data'; readonly source: 'in-app' };

/** An enabling change: sent at once, online only, made from the account's last privacy change. */
export type EnablingChange = { readonly version: 1; readonly choiceId: string; readonly change: 'grant-analytics' | 'allow-ad-data'; readonly basis: number };

/** What a device uploads. */
export type PrivacyChange = RestrictiveChange | EnablingChange;

/**
 * A new device's bootstrap snapshot of the account's current choices (#96),
 * standing for every privacy change up to its sequence. It carries the
 * current generation's analytics ID while consent is granted, and no earlier
 * one: those stay on the server, for export and deletion.
 */
export interface PrivacySnapshot {
  readonly version: 1;
  readonly change: 'snapshot';
  readonly consent: AnalyticsConsent;
  readonly generation: number;
  /** The current generation's ID while consent is granted; otherwise null. */
  readonly analyticsId: string | null;
  /** The ad-data opt-out's source, or null while ad data isn't limited. */
  readonly adDataOptOut: AdDataOptOutSource | null;
}

/** A change as the account accepted it: a grant carries its generation and the analytics ID the server drew. A snapshot stands for every change before it. */
export type AcceptedPrivacyChange =
  | PrivacySnapshot
  | { readonly version: 1; readonly choiceId: string; readonly change: 'withdraw-analytics' | 'allow-ad-data' }
  | { readonly version: 1; readonly choiceId: string; readonly change: 'limit-ad-data'; readonly source: AdDataOptOutSource }
  | { readonly version: 1; readonly choiceId: string; readonly change: 'grant-analytics'; readonly generation: number; readonly analyticsId: string };

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const CHOICE_ID = /^[0-9a-f]{32}$/;
const ANALYTICS_ID = /^[0-9a-f]{32}$/;
const SOURCES: readonly string[] = ['in-app', 'support', 'gpc'] satisfies AdDataOptOutSource[];

/** Exactly these keys, at version 1, with a choice ID. */
function hasShape(value: unknown, ...keys: string[]): value is Record<string, unknown> {
  if (!isObject(value) || value.version !== 1 || typeof value.choiceId !== 'string') return false;
  const expected = new Set(['version', 'choiceId', 'change', ...keys]);
  return Object.keys(value).length === expected.size && Object.keys(value).every((key) => expected.has(key));
}

const isSequence = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;

export function isRestrictiveChange(value: unknown): value is RestrictiveChange {
  if (!isObject(value) || !CHOICE_ID.test(String(value.choiceId))) return false;
  if (value.change === 'withdraw-analytics') return hasShape(value);
  return value.change === 'limit-ad-data' && hasShape(value, 'source') && value.source === 'in-app';
}

export function isEnablingChange(value: unknown): value is EnablingChange {
  return (
    isObject(value) &&
    CHOICE_ID.test(String(value.choiceId)) &&
    (value.change === 'grant-analytics' || value.change === 'allow-ad-data') &&
    hasShape(value, 'basis') &&
    isSequence(value.basis)
  );
}

function isSnapshot(value: Record<string, unknown>): value is Record<string, unknown> & PrivacySnapshot {
  const keys = ['version', 'change', 'consent', 'generation', 'analyticsId', 'adDataOptOut'];
  if (Object.keys(value).length !== keys.length || !keys.every((key) => key in value) || value.version !== 1) return false;
  const { consent, generation, analyticsId, adDataOptOut } = value;
  if (!Number.isSafeInteger(generation) || (generation as number) < 0) return false;
  if (adDataOptOut !== null && !SOURCES.includes(adDataOptOut as string)) return false;
  switch (consent) {
    case 'never-granted':
      return generation === 0 && analyticsId === null;
    case 'withdrawn':
      return (generation as number) >= 1 && analyticsId === null;
    case 'granted':
      return (generation as number) >= 1 && ANALYTICS_ID.test(String(analyticsId));
    default:
      return false;
  }
}

export function isAcceptedChange(value: unknown): value is AcceptedPrivacyChange {
  if (!isObject(value)) return false;
  switch (value.change) {
    case 'snapshot':
      return isSnapshot(value);
    case 'withdraw-analytics':
    case 'allow-ad-data':
      return hasShape(value);
    case 'limit-ad-data':
      return hasShape(value, 'source') && SOURCES.includes(value.source as string);
    case 'grant-analytics':
      return (
        hasShape(value, 'generation', 'analyticsId') &&
        Number.isSafeInteger(value.generation) &&
        (value.generation as number) >= 1 &&
        ANALYTICS_ID.test(String(value.analyticsId))
      );
    default:
      return false;
  }
}

/** The privacy-choices record type: account-state operations, restrictive ones queued and enabling ones sent at once. */
export const privacyChoice: RecordType<PrivacyChange, AcceptedPrivacyChange> = {
  name: 'privacy-choice',
  kind: 'account-state-operation',
  payloadVersion: 1,
  identity: { scheme: 'choice-id', of: (change) => change.choiceId },
  isPayload: (value): value is PrivacyChange => isRestrictiveChange(value) || isEnablingChange(value),
  // An enabling change waits for every pending restrictive one; restrictive changes hold nothing.
  barriers: ['privacy-choice'],
  affectedBy: (_barrier, payload) => isEnablingChange(payload),
  onlineOnly: isEnablingChange,
  acceptance: 'private.accept_privacy_choice_v1',
  // One row, the current choices at the account's last privacy change: a new
  // device's choices and basis. Feed compaction (#98) must keep every privacy
  // change after any cursor a device may still hold, or reset that device to
  // a snapshot: a lost consent withdrawal or opt-out would re-enable a choice,
  // and a basis missing a change makes every enabling change stale.
  snapshot: 'private.snapshot_privacy_choices',
  fromChange(change) {
    const record = isObject(change) ? change.record : undefined;
    return isAcceptedChange(record) ? record : null;
  },
  contribution: null,
  export: { csv: null, json: (change) => change },
  // The deletion job asks the analytics provider to erase every ID in private.analytics_ids before clearing it (Amendment 8 §3).
  deletion: { serverTables: ['private.privacy_choices', 'private.analytics_ids'] },
};
