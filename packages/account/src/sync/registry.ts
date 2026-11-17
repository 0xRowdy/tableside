// Spec 2 Record-type registry

import { type CompletedPracticeSessionRecord, canonicalJson, decodeMoney } from '@tableside/engine';

import { privacyChoice } from '../privacy-record';

import type { QueuedUpload, ReconcileOutcome, RecordRef } from './store';

export type RecordKind = 'immutable-result' | 'revisioned-item' | 'account-state-operation' | 'server-authored-state';

export interface Contribution {
  readonly total: 'practice' | 'casino';
  readonly game: string;
  readonly currency: string;
  readonly amount: string;
}

export interface RecordType<Payload = unknown, Accepted = Payload> {
  readonly name: string;
  readonly kind: RecordKind;
  readonly payloadVersion: number;
  readonly identity: {
    readonly scheme: string;
    of(payload: Payload): string;
  };
  isPayload(value: unknown): value is Payload;
  readonly barriers: readonly string[];
  // Spec 2 Amendment 1 C5
  readonly afterReconciliation?: true;
  affectedBy?(barrier: { readonly recordType: string; readonly payload: unknown }, payload: Payload): boolean;
  onlineOnly?(payload: Payload): boolean;
  readonly ordering?: 'per-device';
  // Spec 2 Amendment 4 §1
  purges?(accepted: Accepted): RecordRef;
  // #98
  reconcile?(stale: {
    readonly payload: Payload;
    readonly operation: string;
    readonly held: { readonly sequence: number; readonly accepted: Accepted } | null;
  }): Exclude<ReconcileOutcome, { readonly kind: 'set-aside' }>;
  readonly acceptance: string | null;
  // Spec 2 Amendment 1 A6
  readonly snapshot: string | null;
  // Spec 2 Amendment 1 A6, History
  readonly detail?: {
    readonly server: string;
    complete(accepted: Accepted): boolean;
    at(accepted: Accepted): number;
  };
  fromChange(change: unknown): Accepted | null;
  readonly contribution: ((accepted: Accepted) => Contribution | null) | null;
  // Spec 2 Export
  readonly export: {
    readonly csv: { readonly header: readonly string[]; row(accepted: Accepted): readonly string[] } | null;
    json(accepted: Accepted): unknown;
  };
  readonly deletion: { readonly serverTables: readonly string[] };
}

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
  'private.bootstrap_snapshots',
  'private.bootstrap_rows',
];

export function isMoney(value: unknown): value is string {
  try {
    decodeMoney(value as string);
    return true;
  } catch {
    return false;
  }
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

export type PracticeSessionSummary = Omit<CompletedPracticeSessionRecord, 'outcomes' | 'guidance'>;

export const completedPracticeSession: RecordType<CompletedPracticeSessionRecord, CompletedPracticeSessionRecord | PracticeSessionSummary> = {
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
  snapshot: 'private.snapshot_completed_practice_sessions',
  detail: {
    server: 'private.detail_completed_practice_sessions',
    complete: (record) => Array.isArray((record as Partial<CompletedPracticeSessionRecord>).outcomes),
    at: (record) => record.endedAt,
  },
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

export function isBarrierFor(type: RecordType, pending: { readonly recordType: string; readonly payload: unknown }, payload: unknown): boolean {
  return type.barriers.includes(pending.recordType) && (type.affectedBy?.(pending, payload) ?? true);
}

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

export const recordTypes: ReadonlyMap<string, RecordType> = new Map<string, RecordType>(
  [completedPracticeSession as unknown as RecordType, privacyChoice as unknown as RecordType].map((type) => [type.name, type]),
);

export type RevisionBase = number | { readonly operation: string };

export type RevisionedUpload<Value> =
  | { readonly item: string; readonly action: 'save'; readonly base: RevisionBase; readonly value: Value }
  | { readonly item: string; readonly action: 'delete'; readonly base: RevisionBase; readonly value: null }
  | {
      readonly item: string;
      readonly action: 'resolve';
      readonly generation: number;
      readonly reviewed: readonly string[];
      readonly value: Value | null;
    };

export interface Proposal<Value> {
  readonly id: string;
  readonly kind: 'edit' | 'delete' | 'recovery';
  readonly installation: string;
  readonly value: Value | null;
}

export interface RevisionedState<Value> {
  readonly revision: number;
  readonly deleted: boolean;
  readonly value: Value | null;
  readonly conflict: { readonly generation: number; readonly proposals: readonly Proposal<Value>[] } | null;
}

export interface RevisionedItemDefinition<Value> {
  readonly name: string;
  readonly payloadVersion: number;
  readonly identityScheme: string;
  readonly acceptance: string;
  isValue(value: unknown): value is Value;
  readonly contribution: ((value: Value) => Contribution | null) | null;
  readonly export: RecordType<RevisionedUpload<Value>, RevisionedState<Value>>['export'];
  readonly deletion: { readonly serverTables: readonly string[] };
}

const isRevision = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const isOperationId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{32}$/.test(value);

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
    reconcile({ payload, operation, held }) {
      if (payload.action === 'resolve') return { kind: 'unconfirmed' };
      const state = held?.accepted ?? null;
      if (held && state) {
        if (state.conflict?.proposals.some((proposal) => proposal.id === operation)) return { kind: 'accepted', sequence: held.sequence };
        if (payload.action === 'delete' ? state.deleted : !state.deleted && canonicalJson(state.value) === canonicalJson(payload.value)) {
          return { kind: 'accepted', sequence: held.sequence };
        }
      }
      if (typeof payload.base === 'number' && (state ? state.revision === payload.base : payload.base === 0)) return { kind: 'unsent' };
      return { kind: 'unconfirmed' };
    },
    acceptance: definition.acceptance,
    snapshot: 'private.snapshot_revisioned_items',
    fromChange(change) {
      const state = isObject(change) ? change.state : undefined;
      return isState(state) ? state : null;
    },
    contribution: contribution ? (state) => (state.value === null ? null : contribution(state.value)) : null,
    export: definition.export,
    deletion: definition.deletion,
  };
  return type;
}
