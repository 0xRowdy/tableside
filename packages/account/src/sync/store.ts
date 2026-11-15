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
}

/** A record the account has accepted, as this installation holds it. */
export interface AcceptedRecord {
  readonly recordType: string;
  readonly item: string;
  /** The account sequence that accepted it. */
  readonly sequence: number;
  readonly payload: unknown;
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
  /** The account sequence this installation has applied the feed through. */
  readFeedCursor(): Promise<number>;
  /**
   * Applies feed entries that follow `from` without a gap, and moves the cursor
   * to the last, in one transaction. Applies nothing and returns false when the
   * cursor is no longer `from`.
   */
  applyFeedPage(from: number, records: readonly AcceptedRecord[]): Promise<boolean>;
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
