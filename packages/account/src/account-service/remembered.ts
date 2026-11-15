// What this installation remembers of the account it is signed in to (in the
// environment's credentials), and the gate that follows from it.

import { type AgeRange, type AgeSignal, type EligibilityRecord, type RequiredCheck, isEligibleBand, isRequiredCheck, parseEligibilityRecord, raisesBand, requiredCheck } from '../eligibility';
import type { EnvironmentName } from '../environment';

import { isCurrency } from '../values';

import { parseJson } from './credentials';
import type { AccountGate, RevokedBy } from './types';

/** Where the signed-in account is remembered, in the environment's credentials (so it goes with them). */
export const rememberedAccountKey = (environment: EnvironmentName) => `tableside.${environment}.account`;

/**
 * The account this installation is signed in to, as this device last knew
 * it: the account's eligibility record (the server's, or a range this
 * device's platform established), this device's own platform state, and the
 * currency it last heard of. After a sign-out only this stays: the account
 * whose database is kept here, locked.
 */
export interface RememberedAccount {
  readonly accountId: string;
  readonly eligibility: EligibilityRecord;
  /** A required platform check this device still owes: it restricts this device only. */
  readonly check?: RequiredCheck;
  /** The last range this device's platform established, applied once; a later change elsewhere isn't overridden by repeating it. */
  readonly signal?: AgeRange;
  /** The last range the server accepted from this device, so each is reported once. */
  readonly reported?: AgeRange;
  readonly currency: string | null;
  readonly signedOut: boolean;
  /** When and by whom the server confirmed this installation's session was revoked; the account is locked (signedOut) since. */
  readonly revoked?: { readonly at: number; readonly by: RevokedBy } | undefined;
  /** When the server last said the account's deletion is scheduled, its deadline (milliseconds since the epoch); absent otherwise. */
  readonly deletionDeadline?: number | undefined;
}

/** The eligibility part of what is remembered. */
export type RememberedEligibility = Pick<RememberedAccount, 'eligibility' | 'check' | 'signal' | 'reported'>;

export const UNAVAILABLE: AgeSignal = { kind: 'unavailable' };
export const sameRecord = (a: EligibilityRecord, b: EligibilityRecord) => a.status === b.status && a.source === b.source;

/** The eligibility after a platform answer: a required check is owed (or cleared), or a newly established range applies. */
export function afterSignal(base: RememberedEligibility, signal: AgeSignal): RememberedEligibility {
  const owed = requiredCheck(signal);
  const next: RememberedEligibility = {
    eligibility: base.eligibility,
    ...(owed ? { check: owed } : {}),
    ...(base.signal ? { signal: base.signal } : {}),
    ...(base.reported ? { reported: base.reported } : {}),
  };
  if (signal.kind !== 'range' || signal.range === base.signal) return next;
  // No platform answer raises a band here, nor under 13: that is support review's (#42), as on the server.
  if (raisesBand(base.eligibility.status, signal.range)) return next;
  return { ...next, eligibility: { status: signal.range, source: 'platform-signal' }, signal: signal.range };
}

/** Only the eligibility fields of `next`, over everything else `base` holds. */
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

/** The gate an open account is in. */
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
  // Remembered before #90 as the bare band, which was always declared.
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
