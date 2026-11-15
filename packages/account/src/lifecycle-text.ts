// Player wording and links the app's deletion screens (S2-22, S2-23) and the
// web account page (S2-24) share, so both say the same thing: the stores'
// billing help, the support pages and the deletion's status. Plain
// TypeScript with no platform imports, so the page can bundle it.

import type { DeletionProgress } from './service';

export type Store = 'app-store' | 'google-play';

/**
 * Billing help (spec 2 Amendments 1 C2, 3 §4, 5 §4): each store's own
 * subscription management and refund-request pages. Never a purchase, and
 * never a claim that anything was canceled or refunded: only the store can
 * say so. Spec 5 owns billing; until then these open the stores' pages.
 */
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

/**
 * The web pages every locked and restricted screen links to (spec 2
 * Amendment 9 §1). They work without signing in. tableside.app stands in
 * until spec 7 buys the domain (D13).
 */
export const WEB_PAGES = {
  contactSupport: 'https://tableside.app/support',
  privacyRequest: 'https://tableside.app/privacy-request',
} as const;

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "17 Oct 2026", in the local time zone. */
export function dayText(at: number): string {
  const day = new Date(at);
  return `${day.getDate()} ${SHORT_MONTHS[day.getMonth()]} ${day.getFullYear()}`;
}

/** A scheduled deletion's status row: its deadline. */
export function scheduledDetail(deadline: number): string {
  return `Scheduled · deleted permanently on ${dayText(deadline)}`;
}

/** A permanent deletion's own row: processing (or delayed) or completed, never a deadline. */
export function deletionDetail(progress: DeletionProgress | null): string {
  if (!progress) return "Can't check right now. Connect to see how it's going.";
  if (progress.status === 'completed') return progress.completedAt !== null ? `Completed on ${dayText(progress.completedAt)}` : 'Completed';
  if (progress.delayed) return "Taking longer than expected · it's still being deleted";
  return `Processing · finished by ${dayText(progress.cleanupBy)}`;
}

/** The analytics provider's erasure: requested, and erased only once the provider says so. */
export function analyticsDetail(progress: DeletionProgress | null): string {
  const { requestedAt, completedAt } = progress?.analytics ?? { requestedAt: null, completedAt: null };
  if (completedAt !== null) return `Erased on ${dayText(completedAt)}`;
  if (requestedAt !== null) return "Erasure requested · the analytics provider hasn't confirmed it yet";
  return 'Erasure not requested yet';
}

/** A Schedule deletion request with no answer: asking again never schedules twice. */
export const SCHEDULE_UNKNOWN = "Couldn't tell whether deletion was scheduled. Check your connection and try again; it won't be scheduled twice.";
/** A Delete permanently now request with no answer: asking again never deletes twice. */
export const DELETION_UNKNOWN = "Couldn't tell whether your account was deleted. Check your connection and try again; it won't be deleted twice.";
export const CANCEL_TOO_LATE = "It's too late to cancel: the deletion date has passed, so your account is being deleted.";
export const CANCEL_FAILED = "Couldn't cancel deletion. Check your connection and try again.";

/** Backups, which age out apart from active cleanup and are never reported as erased. */
export const BACKUPS_DETAIL = 'Backups age out on their own schedule, set out in the privacy policy.';

/** When Tableside held no Apple or Google token to revoke the sign-in grant with. */
export const PROVIDER_GRANT_DETAIL = 'To remove Tableside there too, open your Apple ID or Google Account settings.';
