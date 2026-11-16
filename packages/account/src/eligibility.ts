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

/** Why an account's eligibility is unresolved on this device, as the restricted screen explains it. */
export type UnresolvedReason =
  /** This device's platform requires a check that is pending or has expired: retrying the check may resolve it. */
  | 'check-pending'
  /** This device's platform requires a check that can't be met here: the conflict is surfaced, support can help. */
  | 'check-unmet'
  /** No sufficient evidence is on record: a new signal or the fallback question may resolve it. */
  | 'not-established';

/**
 * A required platform check this device still owes. It restricts this device
 * only: it isn't age information, so it never changes the account's record,
 * and it clears once the platform answers without a requirement.
 */
export type RequiredCheck = 'pending' | 'unmet';

/** How often eligibility refreshes while foregrounded and connected: the same minute as reconciliation. */
export const ELIGIBILITY_REFRESH_MS = 60_000;

const ELIGIBLE: readonly string[] = ['13-15', '16-17', '18+'] satisfies EligibilityBand[];
const STATUSES: readonly string[] = ['under-13', '13-15', '16-17', '18+', 'unresolved'] satisfies EligibilityStatus[];

export const isEligibleBand = (status: string | null | undefined): status is EligibilityBand => typeof status === 'string' && ELIGIBLE.includes(status);

/** The required check a platform answer leaves owing, or null when it requires none. */
export function requiredCheck(signal: AgeSignal): RequiredCheck | null {
  if (signal.kind === 'required-pending') return 'pending';
  if (signal.kind === 'required-unmet') return 'unmet';
  return null;
}

/**
 * Whether the fallback answer may decide: only while nothing sufficient is on
 * record and no required check is owed, so a declaration never overrides a
 * required check or a platform's answer, and an established band is never asked again.
 */
export const declarationPermitted = (current: EligibilityRecord | null, check: RequiredCheck | null = null): boolean =>
  check === null && (current === null || (current.status === 'unresolved' && current.source === 'declaration'));

/** An eligibility record as the server gives it ({ eligibility, source }) or as it is remembered ({ status, source }); null when malformed. */
export function parseEligibilityRecord(value: unknown): EligibilityRecord | null {
  if (typeof value !== 'object' || value === null) return null;
  const { eligibility, status = eligibility, source = 'declaration' } = value as { eligibility?: unknown; status?: unknown; source?: unknown };
  if (typeof status !== 'string' || !STATUSES.includes(status) || (source !== 'declaration' && source !== 'platform-signal')) return null;
  return { status: status as EligibilityStatus, source };
}

const RANK: Readonly<Record<AgeRange, number>> = { 'under-13': 0, '13-15': 1, '16-17': 2, '18+': 3 };

/**
 * Whether a range would raise the account's established band (or move it from
 * under 13). No report does: the server can't verify a platform's answer, so
 * raising a band is support review's (#42). A range may establish a band where
 * none is, or lower one.
 */
export const raisesBand = (current: EligibilityStatus, range: AgeRange): boolean =>
  current === 'under-13' || (current !== 'unresolved' && RANK[range] > RANK[current]);

export const isRequiredCheck = (value: unknown): value is RequiredCheck => value === 'pending' || value === 'unmet';
