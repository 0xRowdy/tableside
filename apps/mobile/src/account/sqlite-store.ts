// Spec 2 Local storage

import { canonicalJson, sha256Hex } from '@tableside/engine';

import type {
  ActivityStore,
  AllowanceEffect,
  CommitOutcome,
  CommittedTransition,
  CompletedPracticeSession,
  IncompleteReason,
  NewActivity,
  OutgoingSyncRecord,
  StoredActivity,
  TransitionCommit,
} from '../practice/store';
import type { SqlConnection, SqlExecutor } from './sql';
import { createSchema, readSchemaVersion, schemaVersionOf, STORE_MIGRATIONS, STORE_SCHEMA_VERSION, type StoreMigration } from './store-schema';

export interface UnfinishedActivity {
  readonly activityId: string;
  readonly kind: 'practice-session';
  readonly game: string;
  readonly mode: 'free-play' | 'guided';
  readonly startedAt: number;
  readonly steps: number;
}

export interface PreparedOperation {
  readonly operationId: string;
  readonly request: string;
  readonly requestHash: string;
}

export type Disposition =
  | { readonly status: 'accepted'; readonly operation: string; readonly requestHash: string; readonly sequence: number }
  | { readonly status: 'rejected'; readonly operation: string; readonly requestHash: string; readonly code: string };

export interface Command {
  readonly generation: number;
  readonly position: number;
}

export interface QueuedUpload {
  readonly id: string;
  readonly recordType: string;
  readonly payload: unknown;
  readonly dependencies: readonly string[];
  readonly operation: PreparedOperation | null;
  readonly failures: number;
  readonly flagged: boolean;
  readonly after?: readonly string[];
  readonly position?: number;
  readonly command?: Command;
  readonly unconfirmed?: true;
}

export interface CommandScope {
  readonly generation: number | null;
  readonly last: number;
  readonly settled: number;
}

export type ReconcileOutcome =
  | { readonly kind: 'accepted'; readonly sequence: number | null }
  | { readonly kind: 'unsent' }
  | { readonly kind: 'unconfirmed' }
  | { readonly kind: 'set-aside' };

export interface RejectedUpload {
  readonly id: string;
  readonly recordType: string;
  readonly payload: unknown;
  readonly code: string;
}

export interface RecordRef {
  readonly recordType: string;
  readonly item: string;
}

export interface AcceptedRecord {
  readonly recordType: string;
  readonly item: string;
  readonly sequence: number;
  readonly payload: unknown;
  readonly origin?: { readonly installation: string; readonly position: number };
  readonly summaryAt?: number;
}

export interface SummaryOnly extends RecordRef {
  readonly sequence: number;
  readonly at: number;
}

// #97
export interface HistoryProgress {
  readonly recent: number | null;
  readonly download: { readonly total: number | null } | null;
}

export interface NewUpload {
  readonly id: string;
  readonly recordType: string;
  readonly item: string;
  readonly payload: unknown;
  readonly dependencies: readonly string[];
  readonly positioned: boolean;
  readonly purges: RecordRef | null;
}

export interface FeedPageEffects {
  readonly redacted?: readonly number[];
  readonly purged?: readonly RecordRef[];
}

export interface TotalsRow {
  readonly total: 'practice' | 'casino';
  readonly game: string;
  readonly currency: string;
  readonly records: number;
  readonly net: string;
}

export interface BootstrapSnapshot {
  readonly snapshot: string;
  readonly watermark: number;
  readonly rows: number;
  readonly totals: readonly TotalsRow[];
}

export interface BootstrapStaging extends BootstrapSnapshot {
  readonly staged: number;
  readonly after: number;
}

export type BootstrapProgress = { readonly installed: true } | { readonly installed: false; readonly staging: BootstrapStaging | null };

export interface LocalRevisionedItem {
  readonly item: string;
  readonly accepted: unknown;
  readonly change: { readonly value: unknown } | null;
  readonly onAccount: boolean;
}

type RevisionBase = number | { readonly operation: string };

interface RevisionedChange {
  readonly item: string;
  readonly action: 'save' | 'delete';
  readonly base: RevisionBase;
  readonly value: unknown;
}

interface QueuedBody {
  readonly id: string;
  readonly kind: string;
  readonly record: unknown;
}

export interface StoreIdentity {
  readonly environment: string;
  readonly accountId: string;
  readonly installationId: string;
}

export interface StoreOptions {
  readonly isCurrent?: () => boolean;
  readonly migrations?: readonly StoreMigration[];
}
const BODY_FORMAT = 1;

export class StoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StoreError';
  }
}

export class StoreIntegrityError extends StoreError {
  constructor(message: string) {
    super(message);
    this.name = 'StoreIntegrityError';
  }
}

export class StaleSessionError extends StoreError {
  constructor() {
    super('the account session that opened this store has ended');
    this.name = 'StaleSessionError';
  }
}

export class StoreMismatchError extends StoreError {
  constructor(message: string) {
    super(message);
    this.name = 'StoreMismatchError';
  }
}

export class UnsupportedSchemaError extends StoreError {
  constructor(
    readonly version: string,
    readonly supported: number = STORE_SCHEMA_VERSION,
  ) {
    super(`the database has schema version ${version}; this build opens version ${supported}`);
    this.name = 'UnsupportedSchemaError';
  }
}

const BODY = 'body, body_format, body_length, body_sha256';

interface BodyRow {
  readonly body: string;
  readonly body_format: number;
  readonly body_length: number;
  readonly body_sha256: string;
}

export class SqliteActivityStore implements ActivityStore {
  private readonly queuedListeners = new Set<() => void>();

  private constructor(
    private readonly connection: SqlConnection,
    readonly identity: StoreIdentity,
    private readonly isCurrent: () => boolean,
  ) {}

  static async open(connection: SqlConnection, identity: StoreIdentity, options: StoreOptions = {}): Promise<SqliteActivityStore> {
    const migrations = options.migrations ?? STORE_MIGRATIONS;
    const version = schemaVersionOf(migrations);
    const owner: Record<string, string> = {
      environment: identity.environment,
      account_id: identity.accountId,
      installation_id: identity.installationId,
    };
    try {
      await connection.transaction(async (tx) => {
        const stored = await readSchemaVersion(tx);
        if (stored === null) return createSchema(tx, owner, migrations);
        if (stored !== version) throw new UnsupportedSchemaError(Number.isNaN(stored) ? 'missing' : String(stored), version);
        const rows = await tx.all<{ name: string; value: string }>('SELECT name, value FROM meta');
        const meta = Object.fromEntries(rows.map((row) => [row.name, row.value]));
        for (const [name, value] of Object.entries(owner)) {
          if (meta[name] !== value) throw new StoreMismatchError(`the database's ${name} is ${meta[name] ?? 'missing'}, not ${value}`);
        }
      });
    } catch (error) {
      await connection.close().catch(() => undefined);
      throw error;
    }
    return new SqliteActivityStore(connection, identity, options.isCurrent ?? (() => true));
  }

  close(): Promise<void> {
    return this.connection.close();
  }

  createActivity(activity: NewActivity): Promise<StoredActivity> {
    return this.transaction(async (tx) => {
      const { owner, device } = activity.specification;
      if (owner !== this.identity.accountId || device !== this.identity.installationId) {
        throw new StoreMismatchError(`activity ${activity.activityId} belongs to another account or installation`);
      }
      const existing = await readActivity(tx, activity.activityId);
      if (existing) return existing;
      const stored: StoredActivity = { ...activity, sequence: 0, completion: null, incomplete: null };
      await tx.run(
        `INSERT INTO activities (activity_id, position, status, sequence, ${BODY})
         VALUES (?, (SELECT coalesce(max(position), 0) + 1 FROM activities), ?, 0, ?, ?, ?, ?)`,
        [activity.activityId, statusOf(stored), ...encode(stored)],
      );
      return decodeText<StoredActivity>(encode(stored)[0]);
    });
  }

  load(activityId: string): Promise<StoredActivity | null> {
    return this.transaction((tx) => readActivity(tx, activityId));
  }

  findUnfinished(): Promise<StoredActivity | null> {
    return this.transaction(async (tx) => {
      const row = await tx.get<BodyRow>(
        `SELECT ${BODY} FROM activities WHERE status = 'unfinished' ORDER BY position LIMIT 1`,
      );
      return row ? decode<StoredActivity>(row) : null;
    });
  }

  // Spec 2 Export, Amendment 2 §5
  async readUnfinishedActivities(): Promise<readonly UnfinishedActivity[]> {
    const activity = await this.findUnfinished();
    if (!activity) return [];
    return [
      {
        activityId: activity.activityId,
        kind: 'practice-session',
        game: activity.specification.game,
        mode: activity.specification.strategy === null ? 'free-play' : 'guided',
        startedAt: activity.createdAt,
        steps: activity.sequence,
      },
    ];
  }

  commitTransition(commit: TransitionCommit): Promise<CommitOutcome> {
    return this.transaction(async (tx): Promise<CommitOutcome> => {
      const activity = await requireActivity(tx, commit.activityId);
      const earlier = await readTransition(tx, commit.activityId, commit.receipt.commandId);
      if (earlier) return { status: 'already-committed', transition: earlier };
      if (activity.sequence !== commit.priorSequence) return { status: 'sequence-conflict', sequence: activity.sequence };
      await addEffects(tx, commit.activityId, commit.effects);
      const transition: CommittedTransition = { receipt: commit.receipt, checkpoint: commit.checkpoint, facts: commit.facts };
      await tx.run(
        `INSERT INTO transitions (activity_id, command_id, sequence, ${BODY}) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [commit.activityId, commit.receipt.commandId, commit.priorSequence, ...encode(transition)],
      );
      await writeActivity(tx, { ...activity, checkpoint: commit.checkpoint, sequence: commit.priorSequence + 1 });
      return { status: 'committed' };
    });
  }

  recordEffects(activityId: string, effects: readonly AllowanceEffect[]): Promise<void> {
    return this.transaction(async (tx) => {
      await requireActivity(tx, activityId);
      await addEffects(tx, activityId, effects);
    });
  }

  readEffects(activityId: string): Promise<readonly AllowanceEffect[]> {
    return this.transaction(async (tx) =>
      (await tx.all<BodyRow>(`SELECT ${BODY} FROM effects WHERE activity_id = ? ORDER BY position`, [activityId])).map((row) =>
        decode<AllowanceEffect>(row),
      ),
    );
  }

  readTransitions(activityId: string): Promise<readonly CommittedTransition[]> {
    return this.transaction(async (tx) =>
      (await tx.all<BodyRow>(`SELECT ${BODY} FROM transitions WHERE activity_id = ? ORDER BY sequence`, [activityId])).map((row) =>
        decode<CommittedTransition>(row),
      ),
    );
  }

  readReceipt(activityId: string, commandId: string): Promise<CommittedTransition | null> {
    return this.transaction((tx) => readTransition(tx, activityId, commandId));
  }

  complete(record: CompletedPracticeSession): Promise<CompletedPracticeSession> {
    let queued = false;
    return this.transaction(async (tx) => {
      if (record.owner !== this.identity.accountId || record.device !== this.identity.installationId) {
        throw new StoreMismatchError(`the result of ${record.activityId} belongs to another account or installation`);
      }
      const activity = await requireActivity(tx, record.activityId);
      if (activity.completion) return activity.completion;
      await writeActivity(tx, { ...activity, completion: record });
      const sync: OutgoingSyncRecord = { id: `completed/${record.activityId}`, kind: 'completed-practice-session', record };
      await tx.run(
        `INSERT INTO outgoing (id, activity_id, record_type, item_id, revisioned, position, ${BODY}, dependencies, status)
         VALUES (?, ?, ?, ?, 0, (SELECT coalesce(max(position), 0) + 1 FROM outgoing), ?, ?, ?, ?, '[]', 'pending')`,
        [sync.id, record.activityId, sync.kind, record.activityId, ...encode(sync)],
      );
      queued = true;
      return decodeText<CompletedPracticeSession>(encode(record)[0]);
    }).then((result) => {
      if (queued) this.notifyQueued();
      return result;
    });
  }

  markIncomplete(activityId: string, reason: IncompleteReason): Promise<StoredActivity> {
    return this.transaction(async (tx) => {
      const activity = await requireActivity(tx, activityId);
      if (activity.completion || activity.incomplete) return activity;
      const marked: StoredActivity = { ...activity, incomplete: reason };
      await writeActivity(tx, marked);
      return decodeText<StoredActivity>(encode(marked)[0]);
    });
  }

  readOutgoing(): Promise<readonly OutgoingSyncRecord[]> {
    return this.transaction(async (tx) =>
      (await tx.all<BodyRow>(`SELECT ${BODY} FROM outgoing WHERE activity_id IS NOT NULL ORDER BY position`)).map((row) =>
        decode<OutgoingSyncRecord>(row),
      ),
    );
  }

  readUploadQueue(): Promise<readonly QueuedUpload[]> {
    return this.transaction(async (tx) => {
      const { generation } = await readScopeRow(tx);
      const rows = await tx.all<
        BodyRow &
          QueueRow & {
            record_type: string;
            failures: number;
            flagged: number;
            device_position: number | null;
            command_generation: number | null;
            command_position: number | null;
            unconfirmed: number;
          }
      >(
        `SELECT ${BODY}, id, record_type, dependencies, operation_id, request, request_sha256, failures, flagged, device_position,
           command_generation, command_position, unconfirmed
         FROM outgoing WHERE status = 'pending' ORDER BY position`,
      );
      const entries: QueuedUpload[] = [];
      for (const row of rows) {
        const outgoing = decode<QueuedBody>(row);
        const dependencies = JSON.parse(row.dependencies) as string[];
        const after =
          dependencies.length === 0
            ? []
            : (
                await tx.all<{ operation_id: string }>(
                  `SELECT operation_id FROM outgoing WHERE operation_id IS NOT NULL AND command_generation IS ? AND id IN (${dependencies.map(() => '?').join(', ')}) ORDER BY position`,
                  [generation, ...dependencies],
                )
              ).map((dependency) => dependency.operation_id);
        entries.push({
          id: row.id,
          recordType: row.record_type,
          payload: outgoing.record,
          dependencies,
          operation: preparedOf(row),
          failures: row.failures,
          flagged: row.flagged === 1,
          ...(after.length > 0 ? { after } : {}),
          ...(row.device_position !== null ? { position: row.device_position } : {}),
          ...(row.command_generation !== null && row.command_position !== null
            ? { command: { generation: row.command_generation, position: row.command_position } }
            : {}),
          ...(row.unconfirmed === 1 ? { unconfirmed: true as const } : {}),
        });
      }
      return entries;
    });
  }

  queueUpload(entry: NewUpload): Promise<QueuedUpload> {
    return this.transaction(async (tx): Promise<QueuedUpload> => {
      let position: number | null = null;
      if (entry.positioned) {
        const last = await tx.get<{ last: number }>('SELECT last FROM device_positions WHERE record_type = ?', [entry.recordType]);
        position = (last?.last ?? 0) + 1;
        await tx.run(
          'INSERT INTO device_positions (record_type, last) VALUES (?, ?) ON CONFLICT (record_type) DO UPDATE SET last = excluded.last',
          [entry.recordType, position],
        );
      }
      const body: QueuedBody = { id: entry.id, kind: entry.recordType, record: entry.payload };
      await tx.run(
        `INSERT INTO outgoing (id, activity_id, record_type, item_id, revisioned, position, ${BODY}, dependencies, status, device_position)
         VALUES (?, NULL, ?, ?, 0, (SELECT coalesce(max(position), 0) + 1 FROM outgoing), ?, ?, ?, ?, ?, 'pending', ?)`,
        [entry.id, entry.recordType, entry.item, ...encode(body), JSON.stringify(entry.dependencies), position],
      );
      if (entry.purges) await purgeRecord(tx, entry.purges);
      return {
        id: entry.id,
        recordType: entry.recordType,
        payload: decodeText<unknown>(encode(entry.payload)[0]),
        dependencies: [...entry.dependencies],
        operation: null,
        failures: 0,
        flagged: false,
        ...(position !== null ? { position } : {}),
      };
    }).then((queued) => {
      this.notifyQueued();
      return queued;
    });
  }

  recordUploadFailure(id: string, flagAt: number): Promise<{ readonly failures: number; readonly flagged: boolean }> {
    return this.transaction(async (tx) => {
      const row = await tx.get<{ failures: number; flagged: number }>(`SELECT failures, flagged FROM outgoing WHERE id = ? AND status = 'pending'`, [id]);
      if (!row) throw new StoreError(`no pending upload ${id}`);
      const failures = row.failures + 1;
      const flagged = row.flagged === 1 || failures >= flagAt;
      await tx.run('UPDATE outgoing SET failures = ?, flagged = ? WHERE id = ?', [failures, flagged ? 1 : 0, id]);
      return { failures, flagged };
    });
  }

  clearUploadFailures(id: string): Promise<void> {
    return this.transaction(async (tx) => {
      await tx.run(`UPDATE outgoing SET failures = 0, flagged = 0 WHERE id = ? AND status = 'pending'`, [id]);
    });
  }

  readRejectedUploads(): Promise<readonly RejectedUpload[]> {
    return this.transaction(async (tx) =>
      (
        await tx.all<BodyRow & { id: string; record_type: string; receipt: string }>(
          `SELECT ${BODY}, id, record_type, receipt FROM outgoing WHERE status = 'rejected' ORDER BY position`,
        )
      ).map((row) => {
        const receipt = JSON.parse(row.receipt) as { code?: unknown };
        return { id: row.id, recordType: row.record_type, payload: decode<QueuedBody>(row).record, code: typeof receipt.code === 'string' ? receipt.code : '' };
      }),
    );
  }

  readLastSynced(): Promise<number | null> {
    return this.transaction(async (tx) => (await tx.get<{ synced_at: number | null }>('SELECT synced_at FROM feed_cursor WHERE singleton = 1'))?.synced_at ?? null);
  }

  recordSynced(at: number): Promise<void> {
    return this.transaction(async (tx) => {
      await tx.run('UPDATE feed_cursor SET synced_at = ? WHERE singleton = 1', [at]);
    });
  }

  prepareUpload(id: string, prepare: (command: Command) => PreparedOperation): Promise<PreparedOperation> {
    return this.transaction(async (tx) => {
      const row = await tx.get<QueueRow>('SELECT id, dependencies, operation_id, request, request_sha256 FROM outgoing WHERE id = ?', [id]);
      if (!row) throw new StoreError(`no upload ${id}`);
      const stored = preparedOf(row);
      if (stored) return stored;
      const command = await nextCommand(tx);
      const operation = prepare(command);
      if (sha256Hex(operation.request) !== operation.requestHash) throw new StoreError('the operation\'s request hash does not match its request');
      await tx.run('UPDATE outgoing SET operation_id = ?, request = ?, request_sha256 = ?, command_generation = ?, command_position = ? WHERE id = ?', [
        operation.operationId,
        operation.request,
        operation.requestHash,
        command.generation,
        command.position,
        id,
      ]);
      return operation;
    });
  }

  readCommandScope(): Promise<CommandScope> {
    return this.transaction(async (tx) => {
      const { generation, last } = await readScopeRow(tx);
      if (generation === null) return { generation, last, settled: 0 };
      const pending = await tx.all<{ dependencies: string; command_position: number | null }>(
        `SELECT dependencies, command_position FROM outgoing WHERE status = 'pending' AND (command_generation IS NULL OR command_generation = ?)`,
        [generation],
      );
      const live = pending.flatMap((row) => (row.command_position !== null ? [row.command_position] : []));
      const named = [...new Set(pending.flatMap((row) => JSON.parse(row.dependencies) as string[]))];
      if (named.length > 0) {
        const rows = await tx.all<{ command_position: number }>(
          `SELECT command_position FROM outgoing WHERE command_generation = ? AND command_position IS NOT NULL AND id IN (${named.map(() => '?').join(', ')})`,
          [generation, ...named],
        );
        live.push(...rows.map((row) => row.command_position));
      }
      return { generation, last, settled: live.length > 0 ? Math.min(...live) - 1 : last };
    });
  }

  adoptCommandScope(generation: number): Promise<void> {
    return this.transaction(async (tx) => {
      if (!Number.isSafeInteger(generation) || generation < 1) throw new StoreError(`invalid command generation ${generation}`);
      await tx.run('UPDATE command_scope SET generation = ?, last = CASE WHEN generation IS ? THEN last ELSE 0 END WHERE singleton = 1', [generation, generation]);
    });
  }

  allocateCommand(): Promise<Command> {
    return this.transaction(nextCommand);
  }

  reconcileUpload(id: string, outcome: ReconcileOutcome): Promise<void> {
    let requeued = false;
    return this.transaction(async (tx) => {
      const row = await tx.get<{ status: string; unconfirmed: number }>('SELECT status, unconfirmed FROM outgoing WHERE id = ?', [id]);
      if (!row) throw new StoreError(`no upload ${id}`);
      if (row.status !== 'pending') return;
      switch (outcome.kind) {
        case 'accepted':
          await tx.run(`UPDATE outgoing SET status = 'accepted', receipt = ?, receipt_sequence = ?, unconfirmed = 0 WHERE id = ?`, [
            canonicalJson({ status: 'accepted', reconciled: true, sequence: outcome.sequence }),
            outcome.sequence,
            id,
          ]);
          await tx.run(
            `DELETE FROM outgoing WHERE id = ? AND revisioned = 1 AND receipt_sequence <=
               (SELECT sequence FROM accepted_records WHERE record_type = outgoing.record_type AND item_id = outgoing.item_id)`,
            [id],
          );
          return;
        case 'unsent':
          await tx.run(
            `UPDATE outgoing SET operation_id = NULL, request = NULL, request_sha256 = NULL, command_generation = NULL, command_position = NULL,
               unconfirmed = 0, failures = 0, flagged = 0 WHERE id = ?`,
            [id],
          );
          requeued = true;
          return;
        case 'unconfirmed':
          await tx.run('UPDATE outgoing SET unconfirmed = 1 WHERE id = ?', [id]);
          return;
        case 'set-aside':
          if (row.unconfirmed !== 1) throw new StoreError(`upload ${id} is not unconfirmed`);
          await tx.run(`UPDATE outgoing SET status = 'rejected', receipt = ?, unconfirmed = 0 WHERE id = ?`, [
            canonicalJson({ status: 'rejected', reconciled: true, code: 'set-aside' }),
            id,
          ]);
          return;
      }
    }).then(() => {
      if (requeued) this.notifyQueued();
    });
  }

  readPurgedItems(recordType: string): Promise<readonly string[]> {
    return this.transaction(async (tx) =>
      (await tx.all<{ item_id: string }>('SELECT item_id FROM purged_records WHERE record_type = ? ORDER BY item_id', [recordType])).map((row) => row.item_id),
    );
  }

  acknowledgeUpload(id: string, disposition: Disposition, accepted: AcceptedRecord | null): Promise<void> {
    return this.transaction(async (tx) => {
      const row = await tx.get<{ status: string; operation_id: string | null }>('SELECT status, operation_id FROM outgoing WHERE id = ?', [id]);
      if (!row) throw new StoreError(`no upload ${id}`);
      if (row.operation_id === null || row.operation_id !== disposition.operation) {
        throw new StoreError(`upload ${id} was not sent as operation ${disposition.operation}`);
      }
      if (row.status !== 'pending') return;
      await tx.run('UPDATE outgoing SET status = ?, receipt = ?, receipt_sequence = ? WHERE id = ?', [
        disposition.status,
        canonicalJson(disposition),
        disposition.status === 'accepted' ? disposition.sequence : null,
        id,
      ]);
      if (accepted) await putAccepted(tx, accepted);
      await tx.run(
        `DELETE FROM outgoing WHERE id = ? AND revisioned = 1 AND status = 'accepted' AND receipt_sequence <=
           (SELECT sequence FROM accepted_records WHERE record_type = outgoing.record_type AND item_id = outgoing.item_id)`,
        [id],
      );
    });
  }

  readFeedCursor(): Promise<number> {
    return this.transaction(readCursor);
  }

  applyFeedPage(from: number, records: readonly AcceptedRecord[], effects: FeedPageEffects = {}): Promise<boolean> {
    return this.transaction(async (tx) => {
      if ((await readCursor(tx)) !== from) return false;
      const sequences = [...records.map((record) => record.sequence), ...(effects.redacted ?? [])].sort((a, b) => a - b);
      for (const [index, sequence] of sequences.entries()) {
        if (sequence !== from + index + 1) throw new StoreError(`feed entry ${sequence} does not follow ${from + index}`);
      }
      for (const record of records) {
        await putAccepted(tx, record);
        await tx.run(
          `DELETE FROM outgoing WHERE revisioned = 1 AND record_type = ? AND item_id = ? AND status = 'accepted' AND receipt_sequence <= ?`,
          [record.recordType, record.item, record.sequence],
        );
      }
      for (const purged of effects.purged ?? []) await purgeRecord(tx, purged);
      if (sequences.length > 0) await tx.run('UPDATE feed_cursor SET sequence = ? WHERE singleton = 1', [from + sequences.length]);
      return true;
    });
  }

  readAcceptedRecords(recordType: string): Promise<readonly AcceptedRecord[]> {
    return this.transaction(async (tx) =>
      (await tx.all<AcceptedRow>(`SELECT ${ACCEPTED} FROM accepted_records WHERE record_type = ? ORDER BY sequence`, [recordType])).map(acceptedOf),
    );
  }

  readAcceptedRecord(recordType: string, item: string): Promise<AcceptedRecord | null> {
    return this.transaction(async (tx) => {
      const row = await tx.get<AcceptedRow>(`SELECT ${ACCEPTED} FROM accepted_records WHERE record_type = ? AND item_id = ?`, [recordType, item]);
      return row ? acceptedOf(row) : null;
    });
  }

  readSummaries({ since, limit }: { readonly since?: number; readonly limit: number }): Promise<readonly SummaryOnly[]> {
    return this.transaction(async (tx) =>
      (
        await tx.all<{ record_type: string; item_id: string; sequence: number; summary_at: number }>(
          `SELECT record_type, item_id, sequence, summary_at FROM accepted_records
           WHERE summary_at IS NOT NULL AND summary_at >= ? ORDER BY summary_at DESC, record_type, item_id LIMIT ?`,
          [since ?? Number.MIN_SAFE_INTEGER, limit],
        )
      ).map((row) => ({ recordType: row.record_type, item: row.item_id, sequence: row.sequence, at: row.summary_at })),
    );
  }

  countSummaries(since?: number): Promise<number> {
    return this.transaction(
      async (tx) =>
        (
          await tx.get<{ count: number }>('SELECT count(*) AS count FROM accepted_records WHERE summary_at IS NOT NULL AND summary_at >= ?', [
            since ?? Number.MIN_SAFE_INTEGER,
          ])
        )?.count ?? 0,
    );
  }

  applyDetails(records: readonly AcceptedRecord[]): Promise<number> {
    return this.transaction(async (tx) => {
      let applied = 0;
      for (const record of records) {
        if (record.summaryAt !== undefined) throw new StoreError(`the detail of ${record.recordType} ${record.item} is a summary`);
        applied += await tx.run(
          `UPDATE accepted_records SET body = ?, body_format = ?, body_length = ?, body_sha256 = ?, summary_at = NULL
           WHERE record_type = ? AND item_id = ? AND sequence = ? AND summary_at IS NOT NULL`,
          [...encode(record.payload), record.recordType, record.item, record.sequence],
        );
      }
      return applied;
    });
  }

  readHistoryProgress(): Promise<HistoryProgress> {
    return this.transaction(readHistory);
  }

  recordHistoryProgress(progress: { readonly recent?: number; readonly downloadRequested?: true; readonly downloadTotal?: number }): Promise<void> {
    return this.transaction(async (tx) => {
      if (progress.recent !== undefined) await tx.run('UPDATE history SET recent = coalesce(recent, ?) WHERE singleton = 1', [progress.recent]);
      if (progress.downloadRequested) await tx.run('UPDATE history SET download_requested = 1 WHERE singleton = 1');
      if (progress.downloadTotal !== undefined) {
        await tx.run('UPDATE history SET download_total = coalesce(download_total, ?) WHERE singleton = 1 AND download_requested = 1', [progress.downloadTotal]);
      }
    });
  }

  writeRevisionedItem(recordType: string, item: string, value: unknown): Promise<void> {
    let queued = false;
    return this.transaction(async (tx) => {
      const accepted = await readAcceptedRow(tx, recordType, item);
      const latest = await latestChange(tx, recordType, item, accepted?.sequence ?? 0);
      const action = value === null ? 'delete' : 'save';
      if (latest?.status === 'pending' && latest.operation_id === null) {
        const change = decode<QueuedBody>(latest).record as RevisionedChange;
        if (action === 'delete' && change.base === 0) {
          await tx.run('DELETE FROM outgoing WHERE id = ?', [latest.id]);
          return;
        }
        const body: QueuedBody = { id: latest.id, kind: recordType, record: { ...change, action, value } };
        await tx.run('UPDATE outgoing SET body = ?, body_format = ?, body_length = ?, body_sha256 = ? WHERE id = ?', [...encode(body), latest.id]);
        queued = true;
        return;
      }
      const state = accepted ? decode<{ revision: number; deleted: boolean }>(accepted) : null;
      if (action === 'delete' && !latest && (!state || state.deleted)) return;
      const base: RevisionBase = latest?.operation_id ? { operation: latest.operation_id } : (state?.revision ?? 0);
      const position = ((await tx.get<{ next: number }>('SELECT coalesce(max(position), 0) + 1 AS next FROM outgoing'))?.next ?? 1);
      const id = `revisioned/${recordType}/${item}/${position}`;
      const body: QueuedBody = { id, kind: recordType, record: { item, action, base, value } satisfies RevisionedChange };
      await tx.run(
        `INSERT INTO outgoing (id, activity_id, record_type, item_id, revisioned, position, ${BODY}, dependencies, status)
         VALUES (?, NULL, ?, ?, 1, ?, ?, ?, ?, ?, ?, 'pending')`,
        [id, recordType, item, position, ...encode(body), JSON.stringify(latest?.status === 'pending' ? [latest.id] : [])],
      );
      queued = true;
    }).then(() => {
      if (queued) this.notifyQueued();
    });
  }

  readRevisionedItems(recordType: string): Promise<readonly LocalRevisionedItem[]> {
    return this.transaction(async (tx) => {
      const accepted = new Map(
        (
          await tx.all<BodyRow & { item_id: string; sequence: number }>(
            `SELECT ${BODY}, item_id, sequence FROM accepted_records WHERE record_type = ?`,
            [recordType],
          )
        ).map((row) => [row.item_id, { sequence: row.sequence, state: decode<unknown>(row) }]),
      );
      const changes = new Map<string, { value: unknown } | null>();
      const acknowledged = new Set<string>();
      for (const row of await tx.all<ChangeRow>(
        `SELECT ${BODY}, id, item_id, status, operation_id, receipt_sequence FROM outgoing
         WHERE revisioned = 1 AND record_type = ? AND status IN ('pending', 'accepted') ORDER BY position`,
        [recordType],
      )) {
        if (row.status === 'accepted') acknowledged.add(row.item_id);
        const reflected = row.status === 'accepted' && (row.receipt_sequence ?? 0) <= (accepted.get(row.item_id)?.sequence ?? 0);
        if (!reflected) changes.set(row.item_id, { value: (decode<QueuedBody>(row).record as RevisionedChange).value });
      }
      return [...new Set([...accepted.keys(), ...changes.keys()])].sort().map((item) => ({
        item,
        accepted: accepted.get(item)?.state ?? null,
        change: changes.get(item) ?? null,
        onAccount: accepted.has(item) || acknowledged.has(item),
      }));
    });
  }

  readBootstrap(): Promise<BootstrapProgress> {
    return this.transaction(readBootstrapProgress);
  }

  beginBootstrap(snapshot: BootstrapSnapshot): Promise<void> {
    return this.transaction(async (tx) => {
      await tx.run('DELETE FROM bootstrap_rows');
      await tx.run('DELETE FROM bootstrap_purges');
      const { snapshot: id, watermark, rows, totals } = snapshot;
      await tx.run(
        'UPDATE bootstrap SET installed = 0, body = ?, body_format = ?, body_length = ?, body_sha256 = ?, staged = 0, after_ordinal = 0 WHERE singleton = 1',
        [...encode({ snapshot: id, watermark, rows, totals })],
      );
    });
  }

  stageBootstrapPage(snapshot: string, after: number, records: readonly AcceptedRecord[], through: number, purged: readonly RecordRef[] = []): Promise<boolean> {
    return this.transaction(async (tx) => {
      const progress = await readBootstrapProgress(tx);
      if (progress.installed || progress.staging?.snapshot !== snapshot || progress.staging.after !== after) return false;
      for (const record of records) {
        await tx.run(
          `INSERT INTO bootstrap_rows (record_type, item_id, sequence, ${BODY}, installation_id, device_position, summary_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            record.recordType,
            record.item,
            record.sequence,
            ...encode(record.payload),
            record.origin?.installation ?? null,
            record.origin?.position ?? null,
            record.summaryAt ?? null,
          ],
        );
      }
      for (const ref of purged) await tx.run('INSERT OR IGNORE INTO bootstrap_purges (record_type, item_id) VALUES (?, ?)', [ref.recordType, ref.item]);
      await tx.run('UPDATE bootstrap SET staged = staged + ?, after_ordinal = ? WHERE singleton = 1', [records.length, through]);
      return true;
    });
  }

  installBootstrap(snapshot: string): Promise<boolean> {
    return this.transaction(async (tx) => {
      const progress = await readBootstrapProgress(tx);
      if (progress.installed || progress.staging?.snapshot !== snapshot) return false;
      const cursor = await readCursor(tx);
      if (cursor > progress.staging.watermark) {
        throw new StoreIntegrityError(`the feed cursor is at ${cursor}, past the snapshot's watermark ${progress.staging.watermark}`);
      }
      for (const ref of await tx.all<{ record_type: string; item_id: string }>('SELECT record_type, item_id FROM bootstrap_purges')) {
        await purgeRecord(tx, { recordType: ref.record_type, item: ref.item_id });
      }
      await tx.run(
        `INSERT INTO accepted_records (record_type, item_id, sequence, ${BODY}, installation_id, device_position, summary_at)
         SELECT record_type, item_id, sequence, ${BODY}, installation_id, device_position, summary_at FROM bootstrap_rows b
         WHERE NOT EXISTS (SELECT 1 FROM purged_records p WHERE p.record_type = b.record_type AND p.item_id = b.item_id)
         ORDER BY position
         ON CONFLICT (record_type, item_id) DO UPDATE SET sequence = excluded.sequence, body = excluded.body,
           body_format = excluded.body_format, body_length = excluded.body_length, body_sha256 = excluded.body_sha256,
           installation_id = excluded.installation_id, device_position = excluded.device_position, summary_at = excluded.summary_at
         WHERE excluded.sequence > accepted_records.sequence`,
      );
      await tx.run(
        `DELETE FROM outgoing WHERE revisioned = 1 AND status = 'accepted' AND receipt_sequence <=
           (SELECT sequence FROM accepted_records WHERE record_type = outgoing.record_type AND item_id = outgoing.item_id)`,
      );
      await tx.run('UPDATE feed_cursor SET sequence = ? WHERE singleton = 1', [progress.staging.watermark]);
      await tx.run('DELETE FROM bootstrap_rows');
      await tx.run('DELETE FROM bootstrap_purges');
      await tx.run(
        'UPDATE bootstrap SET installed = 1, body = NULL, body_format = NULL, body_length = NULL, body_sha256 = NULL, staged = 0, after_ordinal = 0 WHERE singleton = 1',
      );
      return true;
    });
  }

  onUploadQueued(listener: () => void): () => void {
    this.queuedListeners.add(listener);
    return () => this.queuedListeners.delete(listener);
  }

  private notifyQueued(): void {
    for (const listener of this.queuedListeners) listener();
  }

  private transaction<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T> {
    if (!this.isCurrent()) return Promise.reject(new StaleSessionError());
    return this.connection.transaction(async (tx) => {
      if (!this.isCurrent()) throw new StaleSessionError();
      const result = await work(tx);
      if (!this.isCurrent()) throw new StaleSessionError();
      return result;
    });
  }
}

interface QueuedBody {
  readonly id: string;
  readonly kind: string;
  readonly record: unknown;
}

interface QueueRow {
  readonly id: string;
  readonly dependencies: string;
  readonly operation_id: string | null;
  readonly request: string | null;
  readonly request_sha256: string | null;
}

function preparedOf(row: QueueRow): PreparedOperation | null {
  if (row.operation_id === null || row.request === null || row.request_sha256 === null) return null;
  if (sha256Hex(row.request) !== row.request_sha256) throw new StoreIntegrityError('a stored upload request fails its hash');
  return { operationId: row.operation_id, request: row.request, requestHash: row.request_sha256 };
}

interface ChangeRow extends BodyRow {
  readonly id: string;
  readonly item_id: string;
  readonly status: 'pending' | 'accepted';
  readonly operation_id: string | null;
  readonly receipt_sequence: number | null;
}

async function readAcceptedRow(tx: SqlExecutor, recordType: string, item: string) {
  return tx.get<BodyRow & { sequence: number }>(`SELECT ${BODY}, sequence FROM accepted_records WHERE record_type = ? AND item_id = ?`, [
    recordType,
    item,
  ]);
}

async function latestChange(tx: SqlExecutor, recordType: string, item: string, acceptedSequence: number): Promise<ChangeRow | null> {
  return (
    (await tx.get<ChangeRow>(
      `SELECT ${BODY}, id, item_id, status, operation_id, receipt_sequence FROM outgoing
       WHERE revisioned = 1 AND record_type = ? AND item_id = ?
         AND (status = 'pending' OR (status = 'accepted' AND receipt_sequence > ?))
       ORDER BY position DESC LIMIT 1`,
      [recordType, item, acceptedSequence],
    )) ?? null
  );
}

const ACCEPTED = `${BODY}, record_type, item_id, sequence, installation_id, device_position, summary_at`;

interface AcceptedRow extends BodyRow {
  readonly record_type: string;
  readonly item_id: string;
  readonly sequence: number;
  readonly installation_id: string | null;
  readonly device_position: number | null;
  readonly summary_at: number | null;
}

function acceptedOf(row: AcceptedRow): AcceptedRecord {
  return {
    recordType: row.record_type,
    item: row.item_id,
    sequence: row.sequence,
    payload: decode<unknown>(row),
    ...(row.installation_id !== null && row.device_position !== null ? { origin: { installation: row.installation_id, position: row.device_position } } : {}),
    ...(row.summary_at !== null ? { summaryAt: row.summary_at } : {}),
  };
}

async function readHistory(tx: SqlExecutor): Promise<HistoryProgress> {
  const row = await tx.get<{ recent: number | null; download_requested: number; download_total: number | null }>(
    'SELECT recent, download_requested, download_total FROM history WHERE singleton = 1',
  );
  if (!row) throw new StoreIntegrityError('the history progress is missing');
  return { recent: row.recent, download: row.download_requested === 1 ? { total: row.download_total } : null };
}

async function readBootstrapProgress(tx: SqlExecutor): Promise<BootstrapProgress> {
  const row = await tx.get<{ installed: number; staged: number; after_ordinal: number } & { [K in keyof BodyRow]: BodyRow[K] | null }>(
    `SELECT installed, staged, after_ordinal, ${BODY} FROM bootstrap WHERE singleton = 1`,
  );
  if (!row) throw new StoreIntegrityError('the bootstrap progress is missing');
  if (row.installed === 1) return { installed: true };
  const { body, body_format, body_length, body_sha256 } = row;
  if (body === null || body_format === null || body_length === null || body_sha256 === null) return { installed: false, staging: null };
  const snapshot = decode<BootstrapSnapshot>({ body, body_format, body_length, body_sha256 });
  return { installed: false, staging: { ...snapshot, staged: row.staged, after: row.after_ordinal } };
}

async function readScopeRow(tx: SqlExecutor): Promise<{ readonly generation: number | null; readonly last: number }> {
  const row = await tx.get<{ generation: number | null; last: number }>('SELECT generation, last FROM command_scope WHERE singleton = 1');
  if (!row) throw new StoreIntegrityError('the command scope is missing');
  return row;
}

async function nextCommand(tx: SqlExecutor): Promise<Command> {
  const { generation, last } = await readScopeRow(tx);
  if (generation === null) throw new StoreError('no command generation has been adopted');
  await tx.run('UPDATE command_scope SET last = ? WHERE singleton = 1', [last + 1]);
  return { generation, position: last + 1 };
}

async function readCursor(tx: SqlExecutor): Promise<number> {
  const row = await tx.get<{ sequence: number }>('SELECT sequence FROM feed_cursor WHERE singleton = 1');
  if (!row) throw new StoreIntegrityError('the feed cursor is missing');
  return row.sequence;
}

async function putAccepted(tx: SqlExecutor, record: AcceptedRecord): Promise<void> {
  if (await tx.get('SELECT 1 FROM purged_records WHERE record_type = ? AND item_id = ?', [record.recordType, record.item])) return;
  await tx.run(
    `INSERT INTO accepted_records (record_type, item_id, sequence, ${BODY}, installation_id, device_position, summary_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (record_type, item_id) DO UPDATE SET sequence = excluded.sequence, body = excluded.body,
       body_format = excluded.body_format, body_length = excluded.body_length, body_sha256 = excluded.body_sha256,
       installation_id = excluded.installation_id, device_position = excluded.device_position, summary_at = excluded.summary_at
     WHERE excluded.sequence > accepted_records.sequence`,
    [
      record.recordType,
      record.item,
      record.sequence,
      ...encode(record.payload),
      record.origin?.installation ?? null,
      record.origin?.position ?? null,
      record.summaryAt ?? null,
    ],
  );
}

async function purgeRecord(tx: SqlExecutor, ref: RecordRef): Promise<void> {
  await tx.run('DELETE FROM accepted_records WHERE record_type = ? AND item_id = ?', [ref.recordType, ref.item]);
  await tx.run('INSERT OR IGNORE INTO purged_records (record_type, item_id) VALUES (?, ?)', [ref.recordType, ref.item]);
}

const statusOf = (activity: StoredActivity) => (activity.completion ? 'completed' : activity.incomplete ? 'incomplete' : 'unfinished');

async function readActivity(tx: SqlExecutor, activityId: string): Promise<StoredActivity | null> {
  const row = await tx.get<BodyRow>(`SELECT ${BODY} FROM activities WHERE activity_id = ?`, [activityId]);
  return row ? decode<StoredActivity>(row) : null;
}

async function requireActivity(tx: SqlExecutor, activityId: string): Promise<StoredActivity> {
  const activity = await readActivity(tx, activityId);
  if (!activity) throw new StoreError(`no activity ${activityId}`);
  return activity;
}

async function writeActivity(tx: SqlExecutor, activity: StoredActivity): Promise<void> {
  await tx.run(
    'UPDATE activities SET status = ?, sequence = ?, body = ?, body_format = ?, body_length = ?, body_sha256 = ? WHERE activity_id = ?',
    [statusOf(activity), activity.sequence, ...encode(activity), activity.activityId],
  );
}

async function readTransition(tx: SqlExecutor, activityId: string, commandId: string): Promise<CommittedTransition | null> {
  const row = await tx.get<BodyRow>(`SELECT ${BODY} FROM transitions WHERE activity_id = ? AND command_id = ?`, [
    activityId,
    commandId,
  ]);
  return row ? decode<CommittedTransition>(row) : null;
}

async function addEffects(tx: SqlExecutor, activityId: string, effects: readonly AllowanceEffect[]): Promise<void> {
  for (const effect of effects) {
    const { grant, activity, sequence } = effect.effectId;
    await tx.run(
      `INSERT OR IGNORE INTO effects (activity_id, effect_key, position, ${BODY})
       VALUES (?, ?, (SELECT coalesce(max(position), 0) + 1 FROM effects WHERE activity_id = ?), ?, ?, ?, ?)`,
      [activityId, JSON.stringify([grant, activity, sequence]), activityId, ...encode(effect)],
    );
  }
}

function encode(value: unknown): [body: string, format: number, length: number, sha256: string] {
  const body = canonicalJson(withoutUndefined(value));
  return [body, BODY_FORMAT, utf8Length(body), sha256Hex(body)];
}

function decode<T>(row: BodyRow): T {
  if (row.body_format !== BODY_FORMAT) throw new StoreIntegrityError(`unknown stored format ${row.body_format}`);
  if (utf8Length(row.body) !== row.body_length) throw new StoreIntegrityError('a stored value has the wrong length');
  if (sha256Hex(row.body) !== row.body_sha256) throw new StoreIntegrityError('a stored value fails its hash');
  return decodeText<T>(row.body);
}

const decodeText = <T>(text: string): T => JSON.parse(text) as T;

const utf8Length = (text: string): number => new TextEncoder().encode(text).length;

function withoutUndefined(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutUndefined);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .map(([key, entry]) => [key, withoutUndefined(entry)]),
  );
}
