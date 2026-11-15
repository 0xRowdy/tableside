// The record-type registry (spec 2, *Record-type registry*): how a kind of
// record syncs. Each type registers its identity scheme, kind, payload schema
// and version, barriers, server acceptance operation, contribution, export
// rendering and deletion coverage; the platform supplies receipts, ordering and
// the feed for every registered type. The server half is `private.record_types`
// (supabase/migrations): each registration here names the acceptance operation
// registered there for the same type and payload version.

import { type CompletedPracticeSessionRecord, decodeMoney } from '@tableside/engine';

import type { QueuedUpload, RecordRef } from './store';

/**
 * immutable-result: accepted once, never edited (a completed practice session).
 * revisioned-item: one accepted revision with conflicts and tombstones (#94).
 * account-state-operation: ordered account changes, possibly behind barriers:
 *   sharing withdrawals and contributions, allowance reconciliation and
 *   transfers, privacy choices, purging an accepted result.
 * server-authored-state: written only by the backend and delivered through the
 *   feed (experiment assignments, entitlement snapshots, contribution status);
 *   no client writes it, and the server refuses any that tries.
 */
export type RecordKind = 'immutable-result' | 'revisioned-item' | 'account-state-operation' | 'server-authored-state';

export interface RecordType<Payload = unknown> {
  readonly name: string;
  readonly kind: RecordKind;
  readonly payloadVersion: number;
  readonly identity: {
    /** How items of the type are named. */
    readonly scheme: string;
    of(payload: Payload): string;
  };
  /** The payload schema: whether a value is a payload of this type and version. */
  isPayload(value: unknown): value is Payload;
  /** Record types whose pending uploads must be acknowledged before this type's are sent. */
  readonly barriers: readonly string[];
  /**
   * A grant or contribution: the reconnect order's last step (Amendment 1 C5).
   * Sent only once a run has uploaded every other kind and applied the feed
   * through to the account's head (see SyncEngine). Absent: sent in the
   * earlier step, with account state such as sharing withdrawals and
   * allowance reconciliations.
   */
  readonly afterReconciliation?: true;
  /**
   * Whether a pending barrier upload holds this payload; every one of the
   * barrier types does when omitted. A sharing withdrawal holds only the
   * contributions it covers.
   */
  affectedBy?(barrier: { readonly recordType: string; readonly payload: unknown }, payload: Payload): boolean;
  /**
   * per-device: each record carries a durable position on its originating
   * installation, allocated when it is queued (challenge attempts, spec 3).
   * Order comes from it, never from clocks (see ordering.ts). Absent: none.
   */
  readonly ordering?: 'per-device';
  /**
   * An account-state operation that purges an accepted immutable result
   * (Amendment 4 §1): the result it names. Its barrier is the target's
   * acceptance. The result leaves this installation when the operation is
   * queued, and every other one through the feed.
   */
  purges?(payload: Payload): RecordRef;
  /** The server operation that accepts it (`private.record_types.accept`); null for server-authored state. */
  readonly acceptance: string | null;
  /** The payload a feed entry's change carries, or null when the change isn't one of this type's. */
  fromChange(change: unknown): Payload | null;
  /**
   * What an accepted record adds to the account's totals, computed inside the
   * acceptance transaction; null for a type that contributes nothing. Totals
   * and their contribution functions arrive with #94 (casino totals: spec 4).
   */
  readonly contribution: null;
  /** How export renders it (spec 2, *Export*). */
  readonly export: {
    readonly csv: { readonly header: readonly string[]; row(payload: Payload): readonly string[] } | null;
    /** The versioned JSON form. */
    json(payload: Payload): unknown;
  };
  /** Every server table holding the type's rows, all keyed by account_id: what account deletion must clear. */
  readonly deletion: { readonly serverTables: readonly string[] };
}

/**
 * The platform's own per-account tables, whatever types are registered: the
 * synchronization head, the live claim, receipts, the feed, per-device
 * positions and purged results' receipts. Account deletion clears these too.
 */
export const PLATFORM_TABLES: readonly string[] = [
  'private.sync_heads',
  'private.realtime_claims',
  'private.sync_receipts',
  'private.sync_feed',
  'private.device_positions',
  'private.purged_results',
];

/** Canonical money text (spec 1's encoding). */
function isMoney(value: unknown): value is string {
  try {
    decodeMoney(value as string);
    return true;
  } catch {
    return false;
  }
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** Spec 1's completion record and its outgoing synchronization record. */
export const completedPracticeSession: RecordType<CompletedPracticeSessionRecord> = {
  name: 'completed-practice-session',
  kind: 'immutable-result',
  payloadVersion: 1,
  identity: { scheme: 'activity-id', of: (record) => record.activityId },
  isPayload(value): value is CompletedPracticeSessionRecord {
    return (
      isObject(value) &&
      value.recordVersion === 1 &&
      typeof value.activityId === 'string' &&
      typeof value.owner === 'string' &&
      typeof value.device === 'string' &&
      typeof value.game === 'string' &&
      typeof value.startedAt === 'number' &&
      typeof value.endedAt === 'number' &&
      isMoney(value.netResult) &&
      isMoney(value.finalCashOut)
    );
  },
  barriers: [],
  acceptance: 'private.accept_completed_practice_session_v1',
  fromChange(change) {
    const record = isObject(change) ? change.record : undefined;
    return completedPracticeSession.isPayload(record) ? record : null;
  },
  contribution: null,
  export: {
    csv: {
      header: ['practice_session_id', 'game', 'mode', 'started_at', 'ended_at', 'buy_in', 'total_funding', 'final_cash_out', 'net_result', 'turns_played'],
      row: (record) => [
        record.activityId,
        record.game,
        record.mode,
        new Date(record.startedAt).toISOString(),
        new Date(record.endedAt).toISOString(),
        record.buyIn,
        record.cumulativeFunding,
        record.finalCashOut,
        record.netResult,
        String(record.turnsPlayed),
      ],
    },
    json: (record) => record,
  },
  deletion: { serverTables: ['private.practice_results', 'private.sync_receipts', 'private.sync_feed'] },
};

/** Whether a pending upload is one of a type's barriers that holds back this payload. */
export function isBarrierFor(type: RecordType, pending: { readonly recordType: string; readonly payload: unknown }, payload: unknown): boolean {
  return type.barriers.includes(pending.recordType) && (type.affectedBy?.(pending, payload) ?? true);
}

/**
 * The pending uploads a new entry of `type` waits for, so the server can
 * check their receipts too: its barriers that affect it, and a purge's target.
 * A barrier queued later still holds it (the engine checks when sending).
 */
export function prerequisitesOf(
  registry: ReadonlyMap<string, RecordType>,
  type: RecordType,
  payload: unknown,
  queue: readonly QueuedUpload[],
): string[] {
  const target = type.purges?.(payload) ?? null;
  const targetType = target ? registry.get(target.recordType) : undefined;
  return queue
    .filter(
      (entry) =>
        isBarrierFor(type, entry, payload) ||
        (target !== null &&
          targetType !== undefined &&
          entry.recordType === target.recordType &&
          targetType.isPayload(entry.payload) &&
          targetType.identity.of(entry.payload) === target.item),
    )
    .map((entry) => entry.id);
}

/** Every registered type, by name. Specs 3–7 add theirs here. */
export const recordTypes: ReadonlyMap<string, RecordType> = new Map<string, RecordType>(
  [completedPracticeSession as RecordType].map((type) => [type.name, type]),
);
