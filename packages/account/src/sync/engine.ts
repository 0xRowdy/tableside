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
// - Feed pages apply with their cursor atomically, and never past a change
//   this build can't read.
// - Runs coalesce: a request while a run is going makes one more run.
// - The reconnect order (spec 2 Amendment 1 C5): authenticate, then reconcile
//   compatibility, access, allowance ownership and pending privacy (sharing)
//   withdrawals, and only then send grants or contributions. A run uploads
//   every entry except grants and contributions (sharing withdrawals,
//   allowance reconciliations, results), then applies the feed through to the
//   account's head, and only then sends the types registered
//   `afterReconciliation`. Any step the server denies (authentication,
//   access), refuses as incompatible or can't be reached ends the run first.
// - A barrier holds while any affected upload of its type is unacknowledged,
//   wherever it sits in the queue, and the server checks each named
//   dependency has its receipt under the synchronization head (`after`).
// - An uncertain answer (lost, waiting, unreadable) acknowledges nothing: the
//   entry stays pending, with every entry it holds back, until a receipt arrives.
//
// Retry pacing, flagged records and status (#92), chunked results (#93) and
// revisioned items (#94) plug in here.

import { type FeedPage, PROTOCOL_VERSION, type PreparedOperation, type UploadAnswer, prepareOperation } from './protocol';
import { type RecordType, isBarrierFor } from './registry';
import type { AcceptedRecord, Origin, QueuedUpload, RecordRef, SyncStore } from './store';

/** The backend's operations. A rejection means no answer arrived (offline, lost response, denied): try later. */
export interface SyncBackend {
  upload(request: string): Promise<UploadAnswer>;
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
      // Account state first: every other upload, then the feed through to the head.
      const attempted = new Set<string>();
      const accountState = await this.upload({ afterReconciliation: false, attempted });
      if (accountState.fatal || this.stopped) return accountState.fatal;
      const feedError = await this.pull();
      if (feedError || this.stopped) return accountState.error ?? feedError;
      // Only then grants and contributions.
      const grants = await this.upload({ afterReconciliation: true, attempted });
      if (grants.fatal || this.stopped) return grants.fatal;
      const lastFeedError = grants.acknowledged > 0 ? await this.pull() : null;
      return accountState.error ?? grants.error ?? lastFeedError;
    } catch {
      // A local transaction failed and rolled back: the queue and cursor are as
      // they were, so the next run retries. After the session ended (the store
      // refuses a stale session), the dropped work is not an error.
      return this.stopped ? null : 'storage';
    }
  }

  /**
   * One pass over the queue, skipping entries `attempted` already this run.
   * The `afterReconciliation` pass sends grants and contributions, and
   * anything still waiting from the earlier pass; the earlier pass sends
   * everything else. A fatal error (offline, incompatible) ends the run.
   */
  private async upload({ afterReconciliation, attempted }: { readonly afterReconciliation: boolean; readonly attempted: Set<string> }): Promise<UploadPass> {
    const { store, registry } = this.options;
    const queue = await store.readUploadQueue();
    const pending = new Set(queue.map((entry) => entry.id));
    // A barrier holds while any upload of its type that affects the entry is unacknowledged, wherever it sits in the queue.
    const held = (type: RecordType, entry: QueuedUpload) => queue.some((other) => pending.has(other.id) && isBarrierFor(type, other, entry.payload));
    const pass: UploadPass = { fatal: null, error: null, acknowledged: 0 };
    for (const entry of queue) {
      if (attempted.has(entry.id)) continue;
      const type = registry.get(entry.recordType);
      if (!afterReconciliation && type?.afterReconciliation) continue;
      attempted.add(entry.id);
      // No client writes server-authored state.
      if (!type || type.kind === 'server-authored-state' || !type.isPayload(entry.payload)) {
        pass.error ??= 'unsendable';
        continue;
      }
      // Its prerequisites are still unacknowledged: it waits, and a later pass may send it.
      if (entry.dependencies.some((id) => pending.has(id)) || held(type, entry)) {
        attempted.delete(entry.id);
        continue;
      }
      const operation = entry.operation ?? (await store.prepareUpload(entry.id, this.envelope(type, entry)));
      let answer: UploadAnswer;
      try {
        answer = await this.options.backend.upload(operation.request);
      } catch {
        return { ...pass, fatal: 'offline' };
      }
      if (this.stopped) return pass;
      const outcome = await this.settleUpload(entry, type, operation, answer);
      if (outcome === 'acknowledged') {
        pending.delete(entry.id);
        pass.acknowledged += 1;
      } else if (outcome === 'incompatible') {
        return { ...pass, fatal: 'incompatible' };
      } else if (outcome !== 'waiting') {
        pass.error ??= outcome;
      }
    }
    return pass;
  }

  private envelope(type: RecordType, entry: QueuedUpload): PreparedOperation {
    return prepareOperation({
      protocol: PROTOCOL_VERSION,
      operation: this.options.newOperationId(),
      installation: this.options.installationId,
      recordType: type.name,
      payloadVersion: type.payloadVersion,
      item: type.identity.of(entry.payload),
      payload: entry.payload,
      ...(entry.after ? { after: entry.after } : {}),
      ...(entry.position !== undefined ? { position: entry.position } : {}),
    });
  }

  /** Applies the server's answer to an upload: a receipt is acknowledged; anything else leaves it pending. */
  private async settleUpload(
    entry: QueuedUpload,
    type: RecordType,
    operation: PreparedOperation,
    answer: UploadAnswer,
  ): Promise<'acknowledged' | 'waiting' | 'incompatible' | 'unsendable' | 'receipt-mismatch'> {
    switch (answer.status) {
      case 'accepted':
      case 'rejected': {
        if (answer.operation !== operation.operationId || answer.requestHash !== operation.requestHash) return 'receipt-mismatch';
        const origin: Origin | null = entry.position !== undefined ? { installation: this.options.installationId, position: entry.position } : null;
        const accepted: AcceptedRecord | null =
          answer.status === 'accepted'
            ? {
                recordType: type.name,
                item: type.identity.of(entry.payload),
                sequence: answer.sequence,
                payload: entry.payload,
                ...(origin ? { origin } : {}),
              }
            : null;
        await this.options.store.acknowledgeUpload(entry.id, answer, accepted);
        return 'acknowledged';
      }
      // A barrier it names has no receipt on the server yet: sent again on a later run.
      case 'waiting':
        return 'waiting';
      case 'incompatible':
        return 'incompatible';
      case 'operation-reused':
      case 'malformed':
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
      const redacted: number[] = [];
      const purged: RecordRef[] = [];
      let unreadable = false;
      for (const [index, entry] of page.entries.entries()) {
        if (entry.sequence !== cursor + index + 1) {
          unreadable = true;
          break;
        }
        // A purged result's entry: nothing to apply.
        if (entry.change === null) {
          redacted.push(entry.sequence);
          continue;
        }
        const type = registry.get(entry.recordType);
        const payload = type?.fromChange(entry.change) ?? null;
        const origin = type?.ordering === 'per-device' ? originOf(entry.change) : null;
        if (!type || payload === null || (type.ordering === 'per-device' && !origin)) {
          unreadable = true;
          break;
        }
        records.push({ recordType: entry.recordType, item: entry.item, sequence: entry.sequence, payload, ...(origin ? { origin } : {}) });
        if (type.purges) purged.push(type.purges(payload));
      }
      const applied = records.length + redacted.length;
      if (applied > 0) {
        // Another run moved the cursor meanwhile: start again from where it is.
        if (!(await store.applyFeedPage(cursor, records, { redacted, purged }))) {
          cursor = await store.readFeedCursor();
          continue;
        }
        cursor += applied;
      }
      if (unreadable) return 'unreadable-change';
      if (!page.more) return null;
    }
  }
}

interface UploadPass {
  /** An error that ends the run. */
  fatal: SyncErrorCode | null;
  /** The first entry that couldn't be settled; the others carried on. */
  error: SyncErrorCode | null;
  acknowledged: number;
}

/** The platform's part of a per-device type's change: its originating installation and position. */
function originOf(change: unknown): Origin | null {
  const origin = typeof change === 'object' && change !== null ? (change as { origin?: unknown }).origin : undefined;
  if (typeof origin !== 'object' || origin === null) return null;
  const { installation, position } = origin as { installation?: unknown; position?: unknown };
  return typeof installation === 'string' && typeof position === 'number' && Number.isSafeInteger(position) && position >= 1
    ? { installation, position }
    : null;
}
