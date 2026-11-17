// Spec 2 Age eligibility

export type EligibilityBand = '13-15' | '16-17' | '18+';
export type AgeRange = 'under-13' | EligibilityBand;
export type EligibilityStatus = AgeRange | 'unresolved';
export type EligibilitySource = 'declaration' | 'platform-signal';

export interface EligibilityRecord {
  readonly status: EligibilityStatus;
  readonly source: EligibilitySource;
}

export type AgeSignal =
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'declined' }
  | { readonly kind: 'range'; readonly range: AgeRange }
  | { readonly kind: 'required-pending' }
  | { readonly kind: 'required-unmet' };

export interface PlatformAgeSignals {
  readonly supported: boolean;
  check(options: { readonly interactive: boolean }): Promise<AgeSignal>;
}

export const noPlatformAgeSignals: PlatformAgeSignals = {
  supported: false,
  check: async () => ({ kind: 'unavailable' }),
};

export type UnresolvedReason =
  | 'check-pending'
  | 'check-unmet'
  | 'not-established';

export type RequiredCheck = 'pending' | 'unmet';

export const ELIGIBILITY_REFRESH_MS = 60_000;

const ELIGIBLE: readonly string[] = ['13-15', '16-17', '18+'] satisfies EligibilityBand[];
const STATUSES: readonly string[] = ['under-13', '13-15', '16-17', '18+', 'unresolved'] satisfies EligibilityStatus[];

export const isEligibleBand = (status: string | null | undefined): status is EligibilityBand => typeof status === 'string' && ELIGIBLE.includes(status);

export function requiredCheck(signal: AgeSignal): RequiredCheck | null {
  if (signal.kind === 'required-pending') return 'pending';
  if (signal.kind === 'required-unmet') return 'unmet';
  return null;
}

export const declarationPermitted = (current: EligibilityRecord | null, check: RequiredCheck | null = null): boolean =>
  check === null && (current === null || (current.status === 'unresolved' && current.source === 'declaration'));

export function parseEligibilityRecord(value: unknown): EligibilityRecord | null {
  if (typeof value !== 'object' || value === null) return null;
  const { eligibility, status = eligibility, source = 'declaration' } = value as { eligibility?: unknown; status?: unknown; source?: unknown };
  if (typeof status !== 'string' || !STATUSES.includes(status) || (source !== 'declaration' && source !== 'platform-signal')) return null;
  return { status: status as EligibilityStatus, source };
}

const RANK: Readonly<Record<AgeRange, number>> = { 'under-13': 0, '13-15': 1, '16-17': 2, '18+': 3 };

// #42
export const raisesBand = (current: EligibilityStatus, range: AgeRange): boolean =>
  current === 'under-13' || (current !== 'unresolved' && RANK[range] > RANK[current]);

export const isRequiredCheck = (value: unknown): value is RequiredCheck => value === 'pending' || value === 'unmet';
