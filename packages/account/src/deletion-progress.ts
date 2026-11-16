// Reading the server's deletion status answers: shared by the Account
// service and the web account page, with no platform imports.

import type { DeletionProgress, DeletionStatus } from './account-service/types';
import { instant } from './values';

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

/** A deletion that hasn't crossed the boundary: none, or scheduled with its deadline. */
export type PendingDeletion = Exclude<DeletionStatus, DeletionProgress>;

/** The signed-in session's deletion status (deletion_status_v1), or null when it isn't one. */
export function parseDeletionStatus(data: unknown): PendingDeletion | null {
  const value = data as { status?: unknown; deadline?: unknown; scheduledAt?: unknown } | null;
  if (value?.status === 'none') return { status: 'none' };
  const deadline = instant(value?.deadline);
  const scheduledAt = instant(value?.scheduledAt);
  return value?.status === 'scheduled' && deadline !== null && scheduledAt !== null ? { status: 'scheduled', deadline, scheduledAt } : null;
}
