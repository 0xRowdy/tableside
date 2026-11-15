// The local half of synchronization: what the sync engine needs from the
// account's store. The SQLite account store implements it on the same database
// and serialized writer as spec 1's store port (apps/mobile/src/account/sqlite-store.ts),
// so a queue entry is written in the transaction that makes its local change.

import type { Disposition, PreparedOperation } from './protocol';

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
}

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
   * Fixes the operation an entry is sent as, before it is first sent. Once
   * stored it never changes: this returns the stored one, so every retry is identical.
   */
  prepareUpload(id: string, operation: PreparedOperation): Promise<PreparedOperation>;
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
  /** Called after a commit adds an entry to the upload queue. Returns an unsubscribe function. */
  onUploadQueued(listener: () => void): () => void;
}
