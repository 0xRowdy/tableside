// The sync engine for one account session: uploads the queue in dependency
// order, then applies the account's feed after its durable cursor. All local
// writes go through the account store's one writer (SyncStore).
//
// - An entry's operation is fixed in the store before it is first sent, so a
//   lost response, a kill or a duplicate always resends the identical request
//   and the server answers from its durable receipt.
// - A disposition and the queue acknowledgement commit together; until then
//   the entry stays pending. Upload never touches payouts, charges or any
//   other local effect: it only acknowledges.
// - A result too large for one request is sent as a manifest of chunks
//   (protocol.ts). The manifest goes first; when the server reports chunks it
//   hasn't staged (never sent, or expired), those are staged and the identical
//   manifest is sent again. So a retry after a lost answer gets its receipt
//   without resending a chunk, and the payload stays in the queue until then.
// - Feed pages apply with their cursor atomically, and never past a change
//   this build can't read.
// - Runs coalesce: a request while a run is going makes one more run.
//
// Retry pacing, flagged records and status (#92), revisioned items (#94) and
// barrier-bearing operations (#95) plug in here.

import {
  type ChunkAnswer,
  type FeedPage,
  PROTOCOL_VERSION,
  type PreparedOperation,
  type StagedChunk,
  type UploadAnswer,
  chunksOf,
  prepareOperation,
} from './protocol';
import type { RecordType } from './registry';
import type { AcceptedRecord, QueuedUpload, SyncStore } from './store';

/** The backend's operations. A rejection means no answer arrived (offline, lost response, denied): try later. */
export interface SyncBackend {
  upload(request: string): Promise<UploadAnswer>;
  /** Stages one chunk of a result, privately, for the operation whose manifest names it. */
  stageChunk(chunk: StagedChunk): Promise<ChunkAnswer>;
  feed(after: number, pageSize: number): Promise<FeedPage>;
}

/**
 * offline: the backend couldn't be reached or answered nothing usable.
 * incompatible: the server no longer speaks this protocol (an update is required).
 * unsendable: an entry can't be sent (unknown type, invalid payload, operation reused).
 * unreadable-change: the feed holds a change this build can't apply; the cursor stays before it.
 * receipt-mismatch: a receipt doesn't match the request sent.
 * storage: a local write failed (a full disk, an I/O error); nothing was half applied.
 */
export type SyncErrorCode = 'offline' | 'incompatible' | 'unsendable' | 'unreadable-change' | 'receipt-mismatch' | 'storage';

export interface SyncEngineOptions {
  readonly store: SyncStore;
  readonly backend: SyncBackend;
  readonly registry: ReadonlyMap<string, RecordType>;
  readonly installationId: string;
  /** A fresh random operation ID: 32 lowercase hex digits. */
  newOperationId(): string;
}

export const FEED_PAGE_SIZE = 50;

export class SyncEngine {
  private running: Promise<void> | null = null;
  private rerunRequested = false;
  private stopped = false;
  private lastError: SyncErrorCode | null = null;

  constructor(private readonly options: SyncEngineOptions) {}

  /** The last run's error, if it ended on one. */
  get error(): SyncErrorCode | null {
    return this.lastError;
  }

  /** Uploads, then applies the feed. Coalesced: resolves when a run that began after this call has finished. */
  reconcile(): Promise<void> {
    if (this.stopped) return Promise.resolve();
    if (this.running) {
      this.rerunRequested = true;
      return this.running;
    }
    this.running = (async () => {
      try {
        do {
          this.rerunRequested = false;
          this.lastError = await this.run();
        } while (this.rerunRequested && !this.stopped);
      } finally {
        this.running = null;
      }
    })();
    return this.running;
  }

  /** Resolves once no run is going. */
  async idle(): Promise<void> {
    while (this.running) await this.running;
  }

  /** Ends the account session's sync: later answers are dropped and nothing more runs. */
  stop(): void {
    this.stopped = true;
  }

  private async run(): Promise<SyncErrorCode | null> {
    try {
      return (await this.upload()) ?? (await this.pull());
    } catch {
      // A local transaction failed and rolled back: the queue and cursor are as
      // they were, so the next run retries. After the session ended (the store
      // refuses a stale session), the dropped work is not an error.
      return this.stopped ? null : 'storage';
    }
  }

  private async upload(): Promise<SyncErrorCode | null> {
    const { store, registry } = this.options;
    const queue = await store.readUploadQueue();
    const pending = new Set(queue.map((entry) => entry.id));
    // A barrier holds while any upload of its type is unacknowledged, wherever it sits in the queue.
    const barrierPending = (recordType: string) => queue.some((entry) => entry.recordType === recordType && pending.has(entry.id));
    let error: SyncErrorCode | null = null;
    for (const entry of queue) {
      const type = registry.get(entry.recordType);
      if (!type || !type.isPayload(entry.payload)) {
        error ??= 'unsendable';
        continue;
      }
      // Its prerequisites are still unacknowledged: it waits.
      if (entry.dependencies.some((id) => pending.has(id)) || type.barriers.some(barrierPending)) continue;
      let operation: PreparedOperation;
      let chunks: StagedChunk[] | null;
      try {
        operation = entry.operation ?? (await store.prepareUpload(entry.id, this.envelope(type, entry)));
        chunks = unsendableUnless(() => chunksOf(operation, entry.payload));
      } catch (failure) {
        if (failure instanceof UnsendableError) {
          error ??= 'unsendable';
          continue;
        }
        throw failure;
      }
      let answer: UploadAnswer | 'offline';
      try {
        answer = await this.send(operation, chunks);
      } catch {
        return 'offline';
      }
      if (this.stopped) return null;
      if (answer === 'offline') {
        error ??= 'offline';
        continue;
      }
      const outcome = await this.settleUpload(entry, type, operation, answer);
      if (outcome === 'acknowledged') pending.delete(entry.id);
      else if (outcome === 'incompatible') return 'incompatible';
      else error ??= outcome;
    }
    return error;
  }

  /**
   * Sends an operation. A manifest whose chunks the server lacks gets them
   * staged, then is sent once more; still lacking them (they expired meanwhile),
   * it waits for the next run.
   */
  private async send(operation: PreparedOperation, chunks: readonly StagedChunk[] | null): Promise<UploadAnswer | 'offline'> {
    const { backend } = this.options;
    const answer = await backend.upload(operation.request);
    if (answer.status !== 'chunks-missing') return answer;
    const missing = answer.missing.map((index) => chunks?.[index]);
    if (missing.some((chunk) => chunk === undefined)) return { status: 'malformed' };
    for (const chunk of missing as StagedChunk[]) {
      if (this.stopped) return 'offline';
      const staged = await backend.stageChunk(chunk);
      if (staged.status !== 'staged') return { status: staged.status };
    }
    const resent = await backend.upload(operation.request);
    return resent.status === 'chunks-missing' ? 'offline' : resent;
  }

  private envelope(type: RecordType, entry: QueuedUpload): PreparedOperation {
    return unsendableUnless(() => prepareOperation({
      protocol: PROTOCOL_VERSION,
      operation: this.options.newOperationId(),
      installation: this.options.installationId,
      recordType: type.name,
      payloadVersion: type.payloadVersion,
      item: type.identity.of(entry.payload),
      payload: entry.payload,
    }));
  }

  /** Applies the server's answer to an upload: a receipt is acknowledged; anything else leaves it pending. */
  private async settleUpload(
    entry: QueuedUpload,
    type: RecordType,
    operation: PreparedOperation,
    answer: UploadAnswer,
  ): Promise<'acknowledged' | 'incompatible' | 'unsendable' | 'receipt-mismatch'> {
    switch (answer.status) {
      case 'accepted':
      case 'rejected': {
        if (answer.operation !== operation.operationId || answer.requestHash !== operation.requestHash) return 'receipt-mismatch';
        const accepted: AcceptedRecord | null =
          answer.status === 'accepted'
            ? { recordType: type.name, item: type.identity.of(entry.payload), sequence: answer.sequence, payload: entry.payload }
            : null;
        await this.options.store.acknowledgeUpload(entry.id, answer, accepted);
        return 'acknowledged';
      }
      case 'incompatible':
        return 'incompatible';
      case 'operation-reused':
      case 'malformed':
      case 'chunks-missing':
        return 'unsendable';
    }
  }

  private async pull(): Promise<SyncErrorCode | null> {
    const { store, backend, registry } = this.options;
    let cursor = await store.readFeedCursor();
    for (;;) {
      let page: FeedPage;
      try {
        page = await backend.feed(cursor, FEED_PAGE_SIZE);
      } catch {
        return 'offline';
      }
      if (this.stopped) return null;
      const records: AcceptedRecord[] = [];
      let unreadable = false;
      for (const [index, entry] of page.entries.entries()) {
        const payload = entry.sequence === cursor + index + 1 ? registry.get(entry.recordType)?.fromChange(entry.change) : null;
        if (payload === null || payload === undefined) {
          unreadable = true;
          break;
        }
        records.push({ recordType: entry.recordType, item: entry.item, sequence: entry.sequence, payload });
      }
      if (records.length > 0) {
        // Another run moved the cursor meanwhile: start again from where it is.
        if (!(await store.applyFeedPage(cursor, records))) {
          cursor = await store.readFeedCursor();
          continue;
        }
        cursor = records[records.length - 1]!.sequence;
      }
      if (unreadable) return 'unreadable-change';
      if (!page.more) return null;
    }
  }
}

/** An entry that can't be sent as it is: its result is too large to name, or no longer matches its manifest. */
class UnsendableError extends Error {}

function unsendableUnless<T>(prepare: () => T): T {
  try {
    return prepare();
  } catch (failure) {
    throw new UnsendableError(failure instanceof Error ? failure.message : String(failure));
  }
}
