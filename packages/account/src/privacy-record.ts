// The privacy-choices record type (spec 2 Amendment 8 §1, #105): the shapes
// a device uploads and the account accepts, and its registration. The choices
// they make, and the Account service's part, are in privacy.ts. The server
// half is supabase/migrations/20261119083417_privacy_choices.sql.

import type { RecordType } from './sync/registry';

/** never-granted: the account has never opted in. withdrawn: it opted in, then withdrew. */
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

/** A change as the account accepted it: a grant carries its generation and the analytics ID the server drew. */
export type AcceptedPrivacyChange =
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

export function isAcceptedChange(value: unknown): value is AcceptedPrivacyChange {
  if (!isObject(value)) return false;
  switch (value.change) {
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
  fromChange(change) {
    const record = isObject(change) ? change.record : undefined;
    return isAcceptedChange(record) ? record : null;
  },
  contribution: null,
  export: { csv: null, json: (change) => change },
  // The deletion job asks the analytics provider to erase every ID in private.analytics_ids before clearing it (Amendment 8 §3).
  deletion: { serverTables: ['private.privacy_choices', 'private.analytics_ids'] },
};
