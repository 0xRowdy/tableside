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
}

export interface SyncStore {
  /** Unacknowledged entries, in queue order. */
  readUploadQueue(): Promise<readonly QueuedUpload[]>;
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
   * Applies feed entries that follow `from` without a gap, and moves the cursor
   * to the last, in one transaction. Applies nothing and returns false when the
   * cursor is no longer `from`.
   */
  applyFeedPage(from: number, records: readonly AcceptedRecord[]): Promise<boolean>;
  readAcceptedRecords(recordType: string): Promise<readonly AcceptedRecord[]>;
  /** Called after a commit adds an entry to the upload queue. Returns an unsubscribe function. */
  onUploadQueued(listener: () => void): () => void;
}
