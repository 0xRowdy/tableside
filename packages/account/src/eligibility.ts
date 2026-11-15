// Age eligibility (spec 2, *Age eligibility*): the platform age-signal port,
// what each signal proves, and when the fallback question may decide. The
// server keeps the one current record (supabase/migrations, *age_eligibility*)
// and applies the same rules; this side decides what to ask and what to show.

/** An established 13+ age band: the only bands that open ordinary access. */
export type EligibilityBand = '13-15' | '16-17' | '18+';
/** The fallback age-range question's answers, and the ranges a platform signal maps to. */
export type AgeRange = 'under-13' | EligibilityBand;
/** The account's current eligibility: an established band, under 13 (ineligible), or unresolved. */
export type EligibilityStatus = AgeRange | 'unresolved';
/** Where the current record came from. */
export type EligibilitySource = 'declaration' | 'platform-signal';

export interface EligibilityRecord {
  readonly status: EligibilityStatus;
  readonly source: EligibilitySource;
}

/**
 * What a platform age check answered, already reduced to what Tableside may
 * keep: the raw response never leaves the adapter, and nothing in it is logged.
 *
 * - unavailable: no signal here (an older OS, the API absent or not applicable,
 *   an error). It proves nothing.
 * - declined: the person chose not to share an optional signal. It proves
 *   nothing; the fallback question may be asked.
 * - range: the platform established an age range.
 * - required-pending: the platform requires a check that hasn't completed (or
 *   has expired), such as a guardian's approval still pending.
 * - required-unmet: the platform requires a check that can't be met here, such
 *   as a guardian's refusal or a required check this device can't run.
 */
export type AgeSignal =
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'declined' }
  | { readonly kind: 'range'; readonly range: AgeRange }
  | { readonly kind: 'required-pending' }
  | { readonly kind: 'required-unmet' };

/**
 * The platform's age signal: Apple's Declared Age Range (iOS 26+) or Google
 * Play's Age Signals. Each native adapter maps the platform's answer to an
 * AgeSignal and discards the rest.
 */
export interface PlatformAgeSignals {
  /** Whether this device can ask the platform at all. False on older OS versions: the fallback question is used. */
  readonly supported: boolean;
  /**
   * Asks the platform. Interactive checks may show the system's prompt (the
   * Create path's age step, a retry); non-interactive ones never do, answering
   * required-pending when a required check would need the person.
   */
  check(options: { readonly interactive: boolean }): Promise<AgeSignal>;
}

/** A device with no platform age signal: always the fallback question. */
export const noPlatformAgeSignals: PlatformAgeSignals = {
  supported: false,
  check: async () => ({ kind: 'unavailable' }),
};

/** Why an account's eligibility is unresolved, as the restricted screen explains it. */
export type UnresolvedReason =
  /** A required platform check is pending or has expired: retrying the check may resolve it. */
  | 'check-pending'
  /** A required platform check can't be met on this device: the conflict is surfaced, support can help. */
  | 'check-unmet'
  /** No sufficient evidence was given: a new signal or the fallback question may resolve it. */
  | 'not-established';

const ELIGIBLE: readonly string[] = ['13-15', '16-17', '18+'] satisfies EligibilityBand[];
const STATUSES: readonly string[] = ['under-13', '13-15', '16-17', '18+', 'unresolved'] satisfies EligibilityStatus[];

export const isEligibleBand = (status: string | null | undefined): status is EligibilityBand => typeof status === 'string' && ELIGIBLE.includes(status);
export const isEligibilityStatus = (status: unknown): status is EligibilityStatus => typeof status === 'string' && STATUSES.includes(status);

/** What a platform signal makes the record, or null when it proves nothing (the record stands). */
export function recordFromSignal(signal: AgeSignal): EligibilityRecord | null {
  switch (signal.kind) {
    case 'range':
      return { status: signal.range, source: 'platform-signal' };
    case 'required-pending':
    case 'required-unmet':
      return { status: 'unresolved', source: 'platform-signal' };
    default:
      return null;
  }
}

/**
 * Whether the fallback answer may decide: only while nothing sufficient is on
 * record, so a declaration never overrides a required check or a platform's
 * answer, and an established band is never asked again.
 */
export const declarationPermitted = (current: EligibilityRecord | null): boolean =>
  current === null || (current.status === 'unresolved' && current.source === 'declaration');

/** Why an unresolved record is unresolved, given what this device's platform last said. */
export function unresolvedReason(record: EligibilityRecord, signal: AgeSignal | null): UnresolvedReason {
  if (signal?.kind === 'required-unmet') return 'check-unmet';
  return record.source === 'platform-signal' ? 'check-pending' : 'not-established';
}
