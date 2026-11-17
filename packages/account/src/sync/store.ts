import type { BootstrapSnapshot, Command, Disposition, PreparedOperation } from './protocol';

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

export interface RecordRef {
  readonly recordType: string;
  readonly item: string;
}

export interface Origin {
  readonly installation: string;
  readonly position: number;
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

export interface RejectedUpload {
  readonly id: string;
  readonly recordType: string;
  readonly payload: unknown;
  readonly code: string;
}

export interface AcceptedRecord {
  readonly recordType: string;
  readonly item: string;
  readonly sequence: number;
  readonly payload: unknown;
  readonly origin?: Origin;
  readonly summaryAt?: number;
}

export interface SummaryOnly extends RecordRef {
  readonly sequence: number;
  readonly at: number;
}

// Spec 2 History
export interface HistoryProgress {
  readonly recent: number | null;
  readonly download: { readonly total: number | null } | null;
}

export interface LocalRevisionedItem {
  readonly item: string;
  readonly accepted: unknown;
  readonly change: { readonly value: unknown } | null;
  readonly onAccount: boolean;
}

// Spec 2 Bootstrap
export type BootstrapProgress = { readonly installed: true } | { readonly installed: false; readonly staging: BootstrapStaging | null };

export interface BootstrapStaging extends BootstrapSnapshot {
  readonly staged: number;
  readonly after: number;
}

export interface SyncStore {
  readUploadQueue(): Promise<readonly QueuedUpload[]>;
  queueUpload(entry: NewUpload): Promise<QueuedUpload>;
  prepareUpload(id: string, prepare: (command: Command) => PreparedOperation): Promise<PreparedOperation>;
  readCommandScope(): Promise<CommandScope>;
  adoptCommandScope(generation: number): Promise<void>;
  allocateCommand(): Promise<Command>;
  reconcileUpload(id: string, outcome: ReconcileOutcome): Promise<void>;
  readPurgedItems(recordType: string): Promise<readonly string[]>;
  acknowledgeUpload(id: string, disposition: Disposition, accepted: AcceptedRecord | null): Promise<void>;
  recordUploadFailure(id: string, flagAt: number): Promise<{ readonly failures: number; readonly flagged: boolean }>;
  clearUploadFailures(id: string): Promise<void>;
  readRejectedUploads(): Promise<readonly RejectedUpload[]>;
  readLastSynced(): Promise<number | null>;
  recordSynced(at: number): Promise<void>;
  readFeedCursor(): Promise<number>;
  applyFeedPage(from: number, records: readonly AcceptedRecord[], effects?: FeedPageEffects): Promise<boolean>;
  readAcceptedRecords(recordType: string): Promise<readonly AcceptedRecord[]>;
  writeRevisionedItem(recordType: string, item: string, value: unknown): Promise<void>;
  readRevisionedItems(recordType: string): Promise<readonly LocalRevisionedItem[]>;
  readBootstrap(): Promise<BootstrapProgress>;
  beginBootstrap(snapshot: BootstrapSnapshot): Promise<void>;
  stageBootstrapPage(snapshot: string, after: number, records: readonly AcceptedRecord[], through: number, purged?: readonly RecordRef[]): Promise<boolean>;
  installBootstrap(snapshot: string): Promise<boolean>;
  readAcceptedRecord(recordType: string, item: string): Promise<AcceptedRecord | null>;
  readSummaries(query: { readonly since?: number; readonly limit: number }): Promise<readonly SummaryOnly[]>;
  countSummaries(since?: number): Promise<number>;
  applyDetails(records: readonly AcceptedRecord[]): Promise<number>;
  readHistoryProgress(): Promise<HistoryProgress>;
  recordHistoryProgress(progress: { readonly recent?: number; readonly downloadRequested?: true; readonly downloadTotal?: number }): Promise<void>;
  onUploadQueued(listener: () => void): () => void;
}
