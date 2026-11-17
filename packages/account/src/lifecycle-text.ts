// Spec 2 S2-22, S2-23, S2-24

import type { CodeRequestResult, DeletionProgress } from './account-service/types';

export type Store = 'app-store' | 'google-play';

// Spec 2 Amendments 1 C2, 3 §4, 5 §4
export const STORES: Readonly<Record<Store, { readonly name: string; readonly manageUrl: string; readonly refundUrl: string }>> = {
  'app-store': {
    name: 'App Store',
    manageUrl: 'https://apps.apple.com/account/subscriptions',
    refundUrl: 'https://reportaproblem.apple.com',
  },
  'google-play': {
    name: 'Google Play',
    manageUrl: 'https://play.google.com/store/account/subscriptions',
    refundUrl: 'https://support.google.com/googleplay/answer/2479637',
  },
};

// Spec 2 Amendment 9 §1
// TODO(spec 7 D13)
export const WEB_PAGES = {
  contactSupport: 'https://tableside.app/support',
  privacyRequest: 'https://tableside.app/privacy-request',
} as const;

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function dayText(at: number): string {
  const day = new Date(at);
  return `${day.getDate()} ${SHORT_MONTHS[day.getMonth()]} ${day.getFullYear()}`;
}

export function scheduledDetail(deadline: number): string {
  return `Scheduled · deleted permanently on ${dayText(deadline)}`;
}

export function deletionDetail(progress: DeletionProgress | null): string {
  if (!progress) return "Can't check right now. Connect to see how it's going.";
  if (progress.status === 'completed') return progress.completedAt !== null ? `Completed on ${dayText(progress.completedAt)}` : 'Completed';
  if (progress.delayed) return "Taking longer than expected · it's still being deleted";
  return `Processing · finished by ${dayText(progress.cleanupBy)}`;
}

export function analyticsDetail(progress: DeletionProgress | null): string {
  const { requestedAt, completedAt } = progress?.analytics ?? { requestedAt: null, completedAt: null };
  if (completedAt !== null) return `Erased on ${dayText(completedAt)}`;
  if (requestedAt !== null) return "Erasure requested · the analytics provider hasn't confirmed it yet";
  return 'Erasure not requested yet';
}

export function waitText(seconds: number): string {
  const whole = Math.max(1, Math.ceil(seconds));
  if (whole < 60) return `${whole} ${whole === 1 ? 'second' : 'seconds'}`;
  const minutes = Math.ceil(whole / 60);
  if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
  const hours = Math.ceil(minutes / 60);
  return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
}

export function codeRequestProblem(result: Exclude<CodeRequestResult, { status: 'sent' | 'age-required' }>): string {
  return result.status === 'rate-limited'
    ? `Wait ${waitText(result.retryAfterSeconds)} before requesting another code.`
    : "We couldn't send the email. Check the address and your connection, then try again.";
}

export const INVALID_CODE = "That code didn't work. Check it, or send a new code.";

export const SCHEDULE_UNKNOWN = "Couldn't tell whether deletion was scheduled. Check your connection and try again; it won't be scheduled twice.";
export const DELETION_UNKNOWN = "Couldn't tell whether your account was deleted. Check your connection and try again; it won't be deleted twice.";
export const CANCEL_TOO_LATE = "It's too late to cancel: the deletion date has passed, so your account is being deleted.";
export const CANCEL_FAILED = "Couldn't cancel deletion. Check your connection and try again.";

export const BACKUPS_DETAIL = 'Backups age out on their own schedule, set out in the privacy policy.';

export const PROVIDER_GRANT_DETAIL = 'To remove Tableside there too, open your Apple ID or Google Account settings.';
