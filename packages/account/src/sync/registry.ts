// The record-type registry (spec 2, *Record-type registry*): how a kind of
// record syncs. Each type registers its identity scheme, kind, payload schema
// and version, barriers, server acceptance operation, contribution, export
// rendering and deletion coverage; the platform supplies receipts, ordering,
// chunking and the feed for every registered type. The server half is `private.record_types`
// (supabase/migrations): each registration here names the acceptance operation
// registered there for the same type and payload version.

import { type CompletedPracticeSessionRecord, decodeMoney } from '@tableside/engine';

import type { QueuedUpload, RecordRef } from './store';

/**
 * immutable-result: accepted once, never edited (a completed practice session).
 * revisioned-item: one accepted revision with conflicts and tombstones (casino sessions, saved strategies).
 * account-state-operation: ordered account changes, possibly behind barriers:
 *   sharing withdrawals and contributions, allowance reconciliation and
 *   transfers, privacy choices, purging an accepted result.
 * server-authored-state: written only by the backend and delivered through the
 *   feed (experiment assignments, entitlement snapshots, contribution status);
 *   no client writes it, and the server refuses any that tries.
 */
export type RecordKind = 'immutable-result' | 'revisioned-item' | 'account-state-operation' | 'server-authored-state';

/**
 * What one accepted record adds to the account's totals. Practice is always
 * simulated and casino always a real currency, and a total never adds across
 * currencies, so each (total, game, currency) is its own figure. The amount is
 * spec 1's exact money text.
 */
export interface Contribution {
  readonly total: 'practice' | 'casino';
  readonly game: string;
  /** 'simulated' for practice; an ISO 4217 code for casino. */
  readonly currency: string;
  readonly amount: string;
}

/**
 * How a kind of record syncs. `Payload` is what an upload carries and
 * `Accepted` what the account holds once it is accepted: the same for an
 * immutable result; for a revisioned item, an edit and the item's state.
 */
export interface RecordType<Payload = unknown, Accepted = Payload> {
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
  purges?(accepted: Accepted): RecordRef;
  /** The server operation that accepts it (`private.record_types.accept`); null for server-authored state. */
  readonly acceptance: string | null;
  /** What a feed entry's change makes accepted, or null when the change isn't one of this type's. */
  fromChange(change: unknown): Accepted | null;
  /**
   * What an accepted record adds to the account's totals, or null when it adds
   * nothing; null for a type that never contributes. The server's own
   * contribution (`private.record_contributions`) applies the same rule
   * inside the acceptance transaction.
   */
  readonly contribution: ((accepted: Accepted) => Contribution | null) | null;
  /** How export renders it (spec 2, *Export*). */
  readonly export: {
    readonly csv: { readonly header: readonly string[]; row(accepted: Accepted): readonly string[] } | null;
    /** The versioned JSON form. */
    json(accepted: Accepted): unknown;
  };
  /** Every server table holding the type's rows, all keyed by account_id: what account deletion must clear. */
  readonly deletion: { readonly serverTables: readonly string[] };
}

/**
 * The platform's own per-account tables, whatever types are registered: the
 * synchronization head, the live claim, receipts, the feed, staged chunks,
 * synchronization head, the live claim, receipts, the feed, staged chunks,
 * every revisioned item and its open proposals, totals, per-device positions
 * and purged results' receipts. Account deletion clears these too.
 */
export const PLATFORM_TABLES: readonly string[] = [
  'private.sync_heads',
  'private.realtime_claims',
  'private.sync_receipts',
  'private.sync_feed',
  'private.staged_chunks',
  'private.revision_proposals',
  'private.revisioned_items',
  'private.account_totals',
  'private.device_positions',
  'private.purged_results',
];

/** Canonical money text (spec 1's encoding). */
export function isMoney(value: unknown): value is string {
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
  contribution: (record) => ({ total: 'practice', game: record.game, currency: 'simulated', amount: record.netResult }),
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

// ---------------------------------------------------------------------------
// Revisioned items
// ---------------------------------------------------------------------------

/**
 * The accepted revision an edit was made from (0 for a new item), or the
 * installation's own earlier operation on the item: an edit made while that
 * one was sent but not yet reflected in the accepted state follows whatever
 * revision it made.
 */
export type RevisionBase = number | { readonly operation: string };

/** An upload of a revisioned item: a save, a deletion, or a conflict's resolution. */
export type RevisionedUpload<Value> =
  | { readonly item: string; readonly action: 'save'; readonly base: RevisionBase; readonly value: Value }
  | { readonly item: string; readonly action: 'delete'; readonly base: RevisionBase; readonly value: null }
  | {
      readonly item: string;
      readonly action: 'resolve';
      /** The conflict generation reviewed. */
      readonly generation: number;
      /** Every proposal reviewed, by ID. */
      readonly reviewed: readonly string[];
      /** The resolved value; null resolves it as deleted. */
      readonly value: Value | null;
    };

/** A competing change preserved for review. */
export interface Proposal<Value> {
  readonly id: string;
  /** edit: a competing save; delete: a deletion made from an obsolete revision; recovery: a save on a deleted item. */
  readonly kind: 'edit' | 'delete' | 'recovery';
  readonly installation: string;
  /** null for a deletion. */
  readonly value: Value | null;
}

/** A revisioned item as the account has accepted it. */
export interface RevisionedState<Value> {
  readonly revision: number;
  /** A tombstone: the item was deleted, and contributes nothing. */
  readonly deleted: boolean;
  /** The accepted revision's value; null when deleted. While a conflict is open, this is its baseline. */
  readonly value: Value | null;
  readonly conflict: { readonly generation: number; readonly proposals: readonly Proposal<Value>[] } | null;
}

export interface RevisionedItemDefinition<Value> {
  readonly name: string;
  readonly payloadVersion: number;
  readonly identityScheme: string;
  readonly acceptance: string;
  /** The value schema: whether a value is one of this type's at this payload version. */
  isValue(value: unknown): value is Value;
  /** What an accepted, undeleted value adds to totals; a tombstone and any proposal add nothing. */
  readonly contribution: ((value: Value) => Contribution | null) | null;
  readonly export: RecordType<RevisionedUpload<Value>, RevisionedState<Value>>['export'];
  readonly deletion: { readonly serverTables: readonly string[] };
}

const isRevision = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const isOperationId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{32}$/.test(value);

/** A revisioned item type: the platform's upload and state shapes around the type's own values. */
export function revisionedItemType<Value>(definition: RevisionedItemDefinition<Value>): RecordType<RevisionedUpload<Value>, RevisionedState<Value>> {
  const { isValue, contribution } = definition;
  const isValueOrNull = (value: unknown): value is Value | null => value === null || isValue(value);
  const isBase = (base: unknown): base is RevisionBase =>
    isRevision(base) || (isObject(base) && Object.keys(base).length === 1 && isOperationId(base.operation));
  const isProposal = (value: unknown): value is Proposal<Value> =>
    isObject(value) &&
    typeof value.id === 'string' &&
    typeof value.installation === 'string' &&
    (value.kind === 'delete' ? value.value === null : (value.kind === 'edit' || value.kind === 'recovery') && isValue(value.value));
  const isState = (value: unknown): value is RevisionedState<Value> =>
    isObject(value) &&
    Number.isSafeInteger(value.revision) &&
    (value.revision as number) > 0 &&
    (value.deleted === true ? value.value === null : value.deleted === false && isValue(value.value)) &&
    (value.conflict === null ||
      (isObject(value.conflict) &&
        Number.isSafeInteger(value.conflict.generation) &&
        Array.isArray(value.conflict.proposals) &&
        value.conflict.proposals.every(isProposal)));
  const type: RecordType<RevisionedUpload<Value>, RevisionedState<Value>> = {
    name: definition.name,
    kind: 'revisioned-item',
    payloadVersion: definition.payloadVersion,
    identity: { scheme: definition.identityScheme, of: (upload) => upload.item },
    isPayload(value): value is RevisionedUpload<Value> {
      if (!isObject(value) || typeof value.item !== 'string') return false;
      switch (value.action) {
        case 'save':
          return isBase(value.base) && isValue(value.value);
        case 'delete':
          return isBase(value.base) && value.value === null;
        case 'resolve':
          return (
            Number.isSafeInteger(value.generation) &&
            Array.isArray(value.reviewed) &&
            value.reviewed.every((id) => typeof id === 'string') &&
            isValueOrNull(value.value)
          );
        default:
          return false;
      }
    },
    barriers: [],
    acceptance: definition.acceptance,
    fromChange(change) {
      const state = isObject(change) ? change.state : undefined;
      return isState(state) ? state : null;
    },
    // Only the accepted revision counts: a tombstone adds nothing, and proposals never do.
    contribution: contribution ? (state) => (state.value === null ? null : contribution(state.value)) : null,
    export: definition.export,
    deletion: definition.deletion,
  };
  return type;
}
