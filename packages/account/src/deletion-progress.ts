// Reading the server's deletion status answers: shared by the Account
// service and the web account page, with no platform imports.

import type { DeletionProgress } from './service';

/** A server timestamp in milliseconds since the epoch, or null when it isn't one. */
export const instant = (value: unknown): number | null => {
  const at = typeof value === 'string' ? Date.parse(value) : Number.NaN;
  return Number.isFinite(at) ? at : null;
};

/** The server's deletion progress (deletion_progress_v1), or null when it isn't one. */
export function parseProgress(data: unknown): DeletionProgress | null {
  const value = data as {
    status?: unknown; deletedAt?: unknown; cleanupBy?: unknown; completedAt?: unknown; delayed?: unknown;
    analytics?: { requestedAt?: unknown; completedAt?: unknown } | null; providers?: unknown;
  } | null;
  const deletedAt = instant(value?.deletedAt);
  const cleanupBy = instant(value?.cleanupBy);
  if ((value?.status !== 'processing' && value?.status !== 'completed') || deletedAt === null || cleanupBy === null) return null;
  const providers = value.providers;
  return {
    status: value.status,
    deletedAt,
    cleanupBy,
    completedAt: instant(value.completedAt),
    delayed: value.delayed === true,
    analytics: { requestedAt: instant(value.analytics?.requestedAt), completedAt: instant(value.analytics?.completedAt) },
    providers: providers === 'revoked' || providers === 'not-held' || providers === 'none' ? providers : null,
  };
}
