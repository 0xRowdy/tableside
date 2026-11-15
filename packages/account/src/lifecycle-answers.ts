// Reading the server's answers to the lifecycle actions the app and the web
// account page share (code requests, Confirm it's you, scheduling and
// canceling deletion), and the operation ID a retried request repeats. No
// platform imports: the page's bundle carries it too.

import type { CancelDeletionResult, CodeRequestResult, FreshAuthenticationResult } from './account-service/types';
import { instant } from './values';

/** request-code's answer: sent, a wait before asking again, the age step first (Create), or failed. */
export function codeRequestAnswer(httpStatus: number, body: unknown): CodeRequestResult {
  const value = body as { status?: unknown; retryAfter?: unknown } | null;
  if (httpStatus === 200 && value?.status === 'sent') return { status: 'sent' };
  if (httpStatus === 429 && typeof value?.retryAfter === 'number') return { status: 'rate-limited', retryAfterSeconds: value.retryAfter };
  if (httpStatus === 403 && value?.status === 'age-required') return { status: 'age-required' };
  return { status: 'failed' };
}

/** fresh-auth's answer to an emailed code. */
export function freshCodeAnswer(httpStatus: number | undefined, status: unknown): FreshAuthenticationResult {
  if (httpStatus === 200 && status === 'confirmed') return { status: 'confirmed' };
  if (httpStatus === 401 && status === 'invalid-code') return { status: 'invalid-code' };
  return { status: 'failed' };
}

/**
 * schedule-deletion's answer: scheduled with its deadline, Confirm it's you
 * first, or null when no usable answer came (the server's status then decides).
 */
export function scheduleAnswer(
  httpStatus: number | undefined,
  body: unknown,
): { readonly status: 'scheduled'; readonly deadline: number; readonly scheduledAt: number | null } | { readonly status: 'fresh-authentication-required' } | null {
  const value = body as { status?: unknown; deadline?: unknown; scheduledAt?: unknown } | null;
  if (httpStatus === 403 && value?.status === 'fresh-authentication-required') return { status: 'fresh-authentication-required' };
  const deadline = httpStatus === 200 && value?.status === 'scheduled' ? instant(value.deadline) : null;
  return deadline === null ? null : { status: 'scheduled', deadline, scheduledAt: instant(value?.scheduledAt) };
}

/**
 * cancel_deletion_v1's answer. 'canceled' also when it was no longer
 * scheduled: either way the server says the account is active. Null when no
 * usable answer came (the server's status then decides).
 */
export function cancelAnswer(status: unknown): Exclude<CancelDeletionResult, { status: 'offline' | 'failed' }> | null {
  if (status === 'canceled' || status === 'not-scheduled') return { status: 'canceled' };
  if (status === 'fresh-authentication-required' || status === 'too-late') return { status };
  return null;
}

/**
 * The operation ID of a Schedule or Cancel deletion request that got no
 * answer: asking again sends the same one, so the server never accepts it
 * twice and answers with where the deletion stands now. Any answer, or the
 * deletion changing, lets the next request start afresh (`settle`).
 */
export function retriedOperations(newId: () => string) {
  let pending: { readonly scope: unknown; readonly action: 'schedule' | 'cancel'; readonly id: string } | null = null;
  return {
    /** The ID for `action`; `scope` (an account session, say) starts afresh when it changes. */
    id(action: 'schedule' | 'cancel', scope: unknown = null): string {
      if (pending === null || pending.scope !== scope || pending.action !== action) pending = { scope, action, id: newId() };
      return pending.id;
    },
    settle() {
      pending = null;
    },
  };
}
