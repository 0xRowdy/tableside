// Spec 2 Amendment 8 §1; #105

import type { RecordType } from './sync/registry';

export type AnalyticsConsent = 'never-granted' | 'granted' | 'withdrawn';

export type AdDataOptOutSource = 'in-app' | 'support' | 'gpc';

export type RestrictiveChange =
  | { readonly version: 1; readonly choiceId: string; readonly change: 'withdraw-analytics' }
  | { readonly version: 1; readonly choiceId: string; readonly change: 'limit-ad-data'; readonly source: 'in-app' };

export type EnablingChange = { readonly version: 1; readonly choiceId: string; readonly change: 'grant-analytics' | 'allow-ad-data'; readonly basis: number };

export type PrivacyChange = RestrictiveChange | EnablingChange;

// #96
export interface PrivacySnapshot {
  readonly version: 1;
  readonly change: 'snapshot';
  readonly consent: AnalyticsConsent;
  readonly generation: number;
  readonly analyticsId: string | null;
  readonly adDataOptOut: AdDataOptOutSource | null;
}

export type AcceptedPrivacyChange =
  | PrivacySnapshot
  | { readonly version: 1; readonly choiceId: string; readonly change: 'withdraw-analytics' | 'allow-ad-data' }
  | { readonly version: 1; readonly choiceId: string; readonly change: 'limit-ad-data'; readonly source: AdDataOptOutSource }
  | { readonly version: 1; readonly choiceId: string; readonly change: 'grant-analytics'; readonly generation: number; readonly analyticsId: string };

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const CHOICE_ID = /^[0-9a-f]{32}$/;
const ANALYTICS_ID = /^[0-9a-f]{32}$/;
const SOURCES: readonly string[] = ['in-app', 'support', 'gpc'] satisfies AdDataOptOutSource[];

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

export const privacyChoice: RecordType<PrivacyChange, AcceptedPrivacyChange> = {
  name: 'privacy-choice',
  kind: 'account-state-operation',
  payloadVersion: 1,
  identity: { scheme: 'choice-id', of: (change) => change.choiceId },
  isPayload: (value): value is PrivacyChange => isRestrictiveChange(value) || isEnablingChange(value),
  barriers: ['privacy-choice'],
  affectedBy: (_barrier, payload) => isEnablingChange(payload),
  onlineOnly: isEnablingChange,
  acceptance: 'private.accept_privacy_choice_v1',
  // #98
  snapshot: 'private.snapshot_privacy_choices',
  fromChange(change) {
    const record = isObject(change) ? change.record : undefined;
    return isAcceptedChange(record) ? record : null;
  },
  contribution: null,
  export: { csv: null, json: (change) => change },
  // Spec 2 Amendment 8 §3
  deletion: { serverTables: ['private.privacy_choices', 'private.analytics_ids'] },
};
