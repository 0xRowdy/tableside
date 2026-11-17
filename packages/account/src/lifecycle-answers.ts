import type { CancelDeletionResult, CodeRequestResult, FreshAuthenticationResult } from './account-service/types';
import { instant } from './values';

export function codeRequestAnswer(httpStatus: number, body: unknown): CodeRequestResult {
  const value = body as { status?: unknown; retryAfter?: unknown } | null;
  if (httpStatus === 200 && value?.status === 'sent') return { status: 'sent' };
  if (httpStatus === 429 && typeof value?.retryAfter === 'number') return { status: 'rate-limited', retryAfterSeconds: value.retryAfter };
  if (httpStatus === 403 && value?.status === 'age-required') return { status: 'age-required' };
  return { status: 'failed' };
}

export function freshCodeAnswer(httpStatus: number | undefined, status: unknown): FreshAuthenticationResult {
  if (httpStatus === 200 && status === 'confirmed') return { status: 'confirmed' };
  if (httpStatus === 401 && status === 'invalid-code') return { status: 'invalid-code' };
  return { status: 'failed' };
}

export function freshProviderAnswer(httpStatus: number | undefined, status: unknown): FreshAuthenticationResult {
  if (httpStatus === 200 && status === 'confirmed') return { status: 'confirmed' };
  if (httpStatus === 403 && status === 'not-a-method') return { status: 'not-a-method' };
  return { status: 'failed' };
}

export function scheduleAnswer(
  httpStatus: number | undefined,
  body: unknown,
): { readonly status: 'scheduled'; readonly deadline: number; readonly scheduledAt: number | null } | { readonly status: 'fresh-authentication-required' } | null {
  const value = body as { status?: unknown; deadline?: unknown; scheduledAt?: unknown } | null;
  if (httpStatus === 403 && value?.status === 'fresh-authentication-required') return { status: 'fresh-authentication-required' };
  const deadline = httpStatus === 200 && value?.status === 'scheduled' ? instant(value.deadline) : null;
  return deadline === null ? null : { status: 'scheduled', deadline, scheduledAt: instant(value?.scheduledAt) };
}

export function cancelAnswer(status: unknown): Exclude<CancelDeletionResult, { status: 'offline' | 'failed' }> | null {
  if (status === 'canceled' || status === 'not-scheduled') return { status: 'canceled' };
  if (status === 'fresh-authentication-required' || status === 'too-late') return { status };
  return null;
}

export function retriedOperations(newId: () => string) {
  let pending: { readonly scope: unknown; readonly action: 'schedule' | 'cancel'; readonly id: string } | null = null;
  return {
    id(action: 'schedule' | 'cancel', scope: unknown = null): string {
      if (pending === null || pending.scope !== scope || pending.action !== action) pending = { scope, action, id: newId() };
      return pending.id;
    },
    settle() {
      pending = null;
    },
  };
}
