// The local half of synchronization: what the sync engine needs from the
// account's store. The SQLite account store implements it on the same database
// and serialized writer as spec 1's store port (apps/mobile/src/account/sqlite-store.ts),
// so a queue entry is written in the transaction that makes its local change.

import type { BootstrapSnapshot, Command, Disposition, PreparedOperation } from './protocol';

/** An upload waiting for its receipt. */
export interface QueuedUpload {
  /** The queue entry's local ID. */
  readonly id: string;
  readonly recordType: string;
  readonly payload: unknown;
  /** Queue entries that must be acknowledged before this one is sent. */
  readonly dependencies: readonly string[];
  /** Fixed the first time the entry was sent; null before that. */
  readonly operation: PreparedOperation | null;
  /** Attempts that failed for this entry alone (the server refused the request, or it couldn't be sent), since it last succeeded or was retried deliberately. */
  readonly failures: number;
  /** Failed repeatedly: left alone, with its dependents, until a deliberate retry. Never deleted. */
  readonly flagged: boolean;
  /** The operations its acknowledged dependencies were sent as, which the server checks have receipts. Absent when none. */
  readonly after?: readonly string[];
  /** A per-device type's originating-device position, fixed when it was queued. Absent for other types. */
  readonly position?: number;
  /** The command it was prepared as: its scope's generation and its position there. Absent before it is prepared. */
  readonly command?: Command;
  /**
   * Its command scope went stale before a receipt arrived, and the refreshed
   * account doesn't show what became of it: it waits for the player's
   * decision, is never sent by itself, and still holds back whatever it is a barrier for.
   */
  readonly unconfirmed?: true;
}

/**
 * This installation's command scope in the account, as its database holds it.
 * generation: the one the server issued; null before one.
 * last: the last position given under it.
 * settled: every position up to here is settled here: acknowledged, or never
 *   to be sent, and named by no pending entry's barriers or dependencies.
 */
export interface CommandScope {
  readonly generation: number | null;
  readonly last: number;
  readonly settled: number;
}

/**
 * What became of an entry whose command scope went stale, from the refreshed account:
 * accepted: the account shows it (or shows the result it uploaded purged since); acknowledged without a receipt.
 * unsent: the account shows it was never accepted, or the player chose to send it anew: it is prepared again as a new operation.
 * unconfirmed: neither: it waits for the player's decision.
 * set-aside: the player set an unconfirmed entry aside: kept with the refused ones, never sent.
 */
export type ReconcileOutcome =
  | { readonly kind: 'accepted'; readonly sequence: number | null }
  | { readonly kind: 'unsent' }
  | { readonly kind: 'unconfirmed' }
  | { readonly kind: 'set-aside' };

/** A record named by its type and identity. */
export interface RecordRef {
  readonly recordType: string;
  readonly item: string;
}

/** Where a per-device record sits: its originating installation and its position there. */
export interface Origin {
  readonly installation: string;
  readonly position: number;
}

/** An entry to add to the upload queue. */
export interface NewUpload {
  readonly id: string;
  readonly recordType: string;
  /** The item's identity under its record type's scheme. */
  readonly item: string;
  readonly payload: unknown;
  readonly dependencies: readonly string[];
  /** Allocates the type's next originating-device position on this installation, durably, in the same transaction. */
  readonly positioned: boolean;
  /** An accepted result the operation purges: removed from this installation at once, and never accepted here again. */
  readonly purges: RecordRef | null;
}

/** What a feed page does besides adding or replacing its accepted records. */
export interface FeedPageEffects {
  /** Sequences whose entries carry nothing to apply (a purged result's): the cursor steps over them. */
  readonly redacted?: readonly number[];
  /** Results the page purges: removed, and never accepted here again. */
  readonly purged?: readonly RecordRef[];
}

/** An upload whose receipt refused it: kept for review, never sent again and never deleted. */
export interface RejectedUpload {
  readonly id: string;
  readonly recordType: string;
  readonly payload: unknown;
  /** The receipt's refusal code. */
  readonly code: string;
}

/** A record the account has accepted, as this installation holds it. */
export interface AcceptedRecord {
  readonly recordType: string;
  readonly item: string;
  /** The account sequence that accepted it. */
  readonly sequence: number;
  readonly payload: unknown;
  /** A per-device type's origin; absent for other types. */
  readonly origin?: Origin;
}

/** A revisioned item as this installation holds it. */
export interface LocalRevisionedItem {
  readonly item: string;
  /** The account's accepted state as last applied (the record type's `fromChange`), or null before any. */
  readonly accepted: unknown;
  /** This installation's latest change not yet reflected in the accepted state: a value, or null for a deletion. */
  readonly change: { readonly value: unknown } | null;
  /** Whether any of the item reached the account: an accepted state, or an acknowledged upload. */
  readonly onAccount: boolean;
}

/**
 * How far this installation's bootstrap has come (spec 2, *Bootstrap*).
 * installed: the baseline and its cursor are in place; later changes come through the feed.
 * Otherwise `staging` is the snapshot being staged, if one was started.
 */
export type BootstrapProgress = { readonly installed: true } | { readonly installed: false; readonly staging: BootstrapStaging | null };

/** A snapshot being staged: how many of its rows are staged, and the last ordinal staged. */
export interface BootstrapStaging extends BootstrapSnapshot {
  readonly staged: number;
  readonly after: number;
}

export interface SyncStore {
  /** Unacknowledged entries, in queue order. */
  readUploadQueue(): Promise<readonly QueuedUpload[]>;
  /**
   * Adds an entry to the upload queue in one transaction, with its position
   * and its purge's local removal, and announces it after the commit.
   * Returns it as queued.
   */
  queueUpload(entry: NewUpload): Promise<QueuedUpload>;
  /**
   * Fixes the operation an entry is sent as, before it is first sent: gives
   * it the next command position under the current generation and stores
   * what `prepare` makes of it, in one transaction (a failing `prepare` uses
   * no position). Once stored it never changes: this returns the stored one,
   * so every retry is identical. Refuses before a generation is adopted.
   */
  prepareUpload(id: string, prepare: (command: Command) => PreparedOperation): Promise<PreparedOperation>;
  readCommandScope(): Promise<CommandScope>;
  /** Adopts a generation the server issued: positions start again from 1 under a new one. */
  adoptCommandScope(generation: number): Promise<void>;
  /** The next command position under the current generation, durably, for an operation sent at once and never queued (a resolution). */
  allocateCommand(): Promise<Command>;
  /** Settles a pending entry whose command scope went stale, or the player's decision on an unconfirmed one, in one transaction. */
  reconcileUpload(id: string, outcome: ReconcileOutcome): Promise<void>;
  /** The items of a record type purged from the account, as this installation knows them. */
  readPurgedItems(recordType: string): Promise<readonly string[]>;
  /**
   * Applies a receipt's disposition and acknowledges the entry, in one
   * transaction: an acceptance also records the accepted record. Only the
   * entry's own operation can acknowledge it.
   */
  acknowledgeUpload(id: string, disposition: Disposition, accepted: AcceptedRecord | null): Promise<void>;
  /**
   * Counts a failed attempt for a pending entry, in one transaction with its
   * current count: the entry is flagged when the count reaches `flagAt`.
   */
  recordUploadFailure(id: string, flagAt: number): Promise<{ readonly failures: number; readonly flagged: boolean }>;
  /** A deliberate retry: the entry's failures are forgotten and it is no longer flagged. */
  clearUploadFailures(id: string): Promise<void>;
  /** Entries whose receipts refused them, in queue order. */
  readRejectedUploads(): Promise<readonly RejectedUpload[]>;
  /** When this installation last finished a synchronization run with nothing left unanswered, or null. */
  readLastSynced(): Promise<number | null>;
  recordSynced(at: number): Promise<void>;
  /** The account sequence this installation has applied the feed through. */
  readFeedCursor(): Promise<number>;
  /**
   * Applies feed entries that follow `from` without a gap (its records and
   * redacted sequences together), and moves the cursor to the last, in one
   * transaction. Applies nothing and returns false when the cursor is no longer `from`.
   */
  applyFeedPage(from: number, records: readonly AcceptedRecord[], effects?: FeedPageEffects): Promise<boolean>;
  readAcceptedRecords(recordType: string): Promise<readonly AcceptedRecord[]>;
  /**
   * Saves (a value) or deletes (null) a revisioned item on this installation,
   * queuing its upload in the same transaction. The upload names its base:
   * the accepted revision, or the item's own earlier upload when that one was
   * sent but isn't reflected yet. A change to an upload not yet sent replaces
   * it, and deleting an item that never left the installation removes it.
   */
  writeRevisionedItem(recordType: string, item: string, value: unknown): Promise<void>;
  /** Every revisioned item of a type this installation holds, accepted or not. */
  readRevisionedItems(recordType: string): Promise<readonly LocalRevisionedItem[]>;
  readBootstrap(): Promise<BootstrapProgress>;
  /**
   * Starts staging a snapshot, discarding any staged before (an expired or
   * replaced one). Nothing else changes: the upload queue and every local
   * record stay. On an installation with its baseline installed, this is a
   * reset (the feed after its cursor was pruned): it has no baseline until the
   * new one is installed, and its cursor stays where it is until then.
   */
  beginBootstrap(snapshot: BootstrapSnapshot): Promise<void>;
  /**
   * Stages a page of the snapshot's rows, and the results it names purged,
   * and moves its progress to ordinal `through`, in one transaction. Stages
   * nothing and returns false when `snapshot` is no longer the one staging,
   * or its progress is no longer at `after`.
   */
  stageBootstrapPage(snapshot: string, after: number, records: readonly AcceptedRecord[], through: number, purged?: readonly RecordRef[]): Promise<boolean>;
  /**
   * Installs the staged snapshot as the baseline and moves the feed cursor to
   * its watermark, in one transaction, before any later feed entry applies.
   * Records accepted here since (a later sequence) are kept; nothing else
   * local is removed, except the results the snapshot names purged, which are
   * never accepted here again. Returns false when `snapshot` is no longer the one staging.
   */
  installBootstrap(snapshot: string): Promise<boolean>;
  /** Called after a commit adds an entry to the upload queue. Returns an unsubscribe function. */
  onUploadQueued(listener: () => void): () => void;
}
