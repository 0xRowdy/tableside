import { type AgeRange, type AgeSignal, type EligibilityRecord, type RequiredCheck, isEligibleBand, isRequiredCheck, parseEligibilityRecord, raisesBand, requiredCheck } from '../eligibility';
import type { EnvironmentName } from '../environment';

import { isCurrency } from '../values';

import { parseJson } from './credentials';
import type { AccountGate, RevokedBy } from './types';

export const rememberedAccountKey = (environment: EnvironmentName) => `tableside.${environment}.account`;

export interface RememberedAccount {
  readonly accountId: string;
  readonly eligibility: EligibilityRecord;
  readonly check?: RequiredCheck;
  readonly signal?: AgeRange;
  readonly reported?: AgeRange;
  readonly currency: string | null;
  readonly signedOut: boolean;
  readonly revoked?: { readonly at: number; readonly by: RevokedBy } | undefined;
  readonly deletionDeadline?: number | undefined;
}

export type RememberedEligibility = Pick<RememberedAccount, 'eligibility' | 'check' | 'signal' | 'reported'>;

export const UNAVAILABLE: AgeSignal = { kind: 'unavailable' };
export const sameRecord = (a: EligibilityRecord, b: EligibilityRecord) => a.status === b.status && a.source === b.source;

export function afterSignal(base: RememberedEligibility, signal: AgeSignal): RememberedEligibility {
  const owed = requiredCheck(signal);
  const next: RememberedEligibility = {
    eligibility: base.eligibility,
    ...(owed ? { check: owed } : {}),
    ...(base.signal ? { signal: base.signal } : {}),
    ...(base.reported ? { reported: base.reported } : {}),
  };
  if (signal.kind !== 'range' || signal.range === base.signal) return next;
  // #42
  if (raisesBand(base.eligibility.status, signal.range)) return next;
  return { ...next, eligibility: { status: signal.range, source: 'platform-signal' }, signal: signal.range };
}

export const withEligibility = (base: RememberedAccount, next: RememberedEligibility): RememberedAccount => ({
  accountId: base.accountId,
  currency: base.currency,
  signedOut: base.signedOut,
  ...(base.revoked ? { revoked: base.revoked } : {}),
  ...(base.deletionDeadline !== undefined ? { deletionDeadline: base.deletionDeadline } : {}),
  eligibility: next.eligibility,
  ...(next.check ? { check: next.check } : {}),
  ...(next.signal ? { signal: next.signal } : {}),
  ...(next.reported ? { reported: next.reported } : {}),
});

export function gateFor(remembered: RememberedAccount, renewing: boolean): AccountGate {
  const { accountId, eligibility, check, deletionDeadline } = remembered;
  if (deletionDeadline !== undefined) return { state: 'deletion-scheduled', accountId, deadline: deletionDeadline };
  if (eligibility.status === 'under-13') return { state: 'age-ineligible', accountId };
  if (check) return { state: 'age-unresolved', accountId, reason: check === 'unmet' ? 'check-unmet' : 'check-pending' };
  if (isEligibleBand(eligibility.status)) return { state: renewing ? 'renewal-pending' : 'active', accountId, eligibility: eligibility.status };
  return { state: 'age-unresolved', accountId, reason: eligibility.source === 'platform-signal' ? 'check-pending' : 'not-established' };
}

export function parseRemembered(text: string | null): RememberedAccount | null {
  const value = parseJson(text) as
    | {
        accountId?: unknown;
        eligibility?: unknown;
        check?: unknown;
        signal?: unknown;
        reported?: unknown;
        currency?: unknown;
        signedOut?: unknown;
        revoked?: { at?: unknown; by?: unknown };
        deletionDeadline?: unknown;
      }
    | null;
  if (!value || typeof value.accountId !== 'string') return null;
  // #90
  const eligibility = parseEligibilityRecord(typeof value.eligibility === 'string' ? { eligibility: value.eligibility } : value.eligibility);
  if (!eligibility) return null;
  return {
    accountId: value.accountId,
    eligibility,
    ...(isRequiredCheck(value.check) ? { check: value.check } : {}),
    ...(isAgeRange(value.signal) ? { signal: value.signal } : {}),
    ...(isAgeRange(value.reported) ? { reported: value.reported } : {}),
    currency: isCurrency(value.currency) ? value.currency : null,
    signedOut: value.signedOut === true,
    ...(value.signedOut === true && typeof value.revoked?.at === 'number'
      ? { revoked: { at: value.revoked.at, by: value.revoked.by === 'provider' ? ('provider' as const) : ('device' as const) } }
      : {}),
    ...(typeof value.deletionDeadline === 'number' && Number.isFinite(value.deletionDeadline) ? { deletionDeadline: value.deletionDeadline } : {}),
  };
}

export const isAgeRange = (value: unknown): value is AgeRange => value === 'under-13' || (typeof value === 'string' && isEligibleBand(value));
