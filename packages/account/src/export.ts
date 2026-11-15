// Export my data (spec 2, *Export*; S2-21): the server export, built by a job
// from everything the account holds and downloaded only by a session that
// confirmed it's the player; and the local supplement, built here from what
// hasn't reached the account, with no upload. Both work on the restricted
// paths (an account whose age isn't established exports too).

import type { RecordType } from './sync/registry';
import type { SyncStore } from './sync/store';

/** The account's latest server export, as the player sees it. Times in milliseconds since the epoch. */
export type ServerExport =
  | { readonly state: 'none' }
  | { readonly state: 'preparing'; readonly requestedAt: number }
  | { readonly state: 'ready'; readonly requestedAt: number; readonly readyAt: number; readonly expiresAt: number; readonly bytes: number }
  | { readonly state: 'failed'; readonly requestedAt: number }
  /** Past its 24 hours. */
  | { readonly state: 'expired'; readonly requestedAt: number }
  /**
   * Ended early: replaced by a newer one, a device was signed out (revocation),
   * or deletion was scheduled. A new one can be asked for (deletion scheduled: after #103).
   */
  | { readonly state: 'ended'; readonly requestedAt: number; readonly by: 'regenerated' | 'revocation' | 'deletion-scheduled' | 'deleted' };

type NeedsFresh = { readonly status: 'fresh-authentication-required' };

export type ServerExportRequest =
  /** Asked for: the job builds it, then emails "export ready". */
  | { readonly status: 'requested'; readonly export: ServerExport }
  /** One is being built already: that one. */
  | { readonly status: 'preparing'; readonly export: ServerExport }
  | NeedsFresh
  | { readonly status: 'failed' };

export type ServerExportDownload =
  /** The archive (a zip), and the name to save it as. */
  | { readonly status: 'downloaded'; readonly fileName: string; readonly bytes: Uint8Array }
  | NeedsFresh
  /** Nothing ready to download: none asked for, still preparing, or ended. */
  | { readonly status: 'not-ready' }
  | { readonly status: 'failed' };

/** An unfinished activity on this installation, without its hidden state (a shuffled shoe, a Check attempt's answers). */
export interface UnfinishedActivity {
  readonly activityId: string;
  readonly kind: 'practice-session';
  readonly game: string;
  readonly mode: 'free-play' | 'guided';
  readonly startedAt: number;
  /** Moves committed so far (each bet, deal or decision the engine committed). */
  readonly steps: number;
}

/** What the account store tells the local supplement about unfinished activities (the app's store implements it). */
export interface UnfinishedActivities {
  readUnfinishedActivities(): Promise<readonly UnfinishedActivity[]>;
}

/**
 * Where a supplement entry stands:
 * waiting: saved here, not sent yet; sending: sent, its answer not back yet;
 * flagged: failing repeatedly, waiting for a retry; refused: the account refused it, kept for review;
 * conflict: a competing edit awaiting review; unfinished: an activity still in progress.
 */
export type SupplementStatus = 'waiting' | 'sending' | 'flagged' | 'refused' | 'conflict' | 'unfinished';

export interface SupplementEntry {
  readonly recordType: string;
  readonly item: string;
  /** The installation it was made on. */
  readonly installation: string;
  /**
   * An unsynced edit: the accepted revision it was made from (0: a new item).
   * A conflict proposal: the accepted revision it competes with (the
   * conflict baseline). Null where revisions don't apply or aren't known.
   */
  readonly revision: number | null;
  readonly syncStatus: SupplementStatus;
  /** A refusal's code. */
  readonly refusal?: string;
  /** The record as its type renders it for export. */
  readonly record: unknown;
}

/** The local supplement: a labeled export of what this installation holds that hasn't reached the account. */
export interface LocalSupplement {
  readonly format: 'tableside-local-supplement';
  readonly version: 1;
  readonly createdAt: string;
  readonly account: string;
  /** The installation that made it. */
  readonly installation: string;
  readonly notice: string;
  /** Records saved here that haven't reached the account. None of them is a finished, synced session. */
  readonly unsynced: readonly SupplementEntry[];
  /** Competing edits to records the account holds: the accepted revision, and each proposal as it is. Nothing is resolved. */
  readonly conflicts: readonly {
    readonly recordType: string;
    readonly item: string;
    readonly acceptedRevision: number;
    readonly accepted: unknown;
    readonly proposals: readonly SupplementEntry[];
  }[];
  readonly unfinished: readonly (UnfinishedActivity & { readonly installation: string; readonly syncStatus: 'unfinished' })[];
}

export const SUPPLEMENT_NOTICE =
  "These records are on this device only and haven't reached your account. They aren't finished sessions or account totals, " +
  "and conflicts in them aren't resolved. Records on your other devices aren't included.";

export interface AccountExport {
  /** The latest server export. Null when no account is signed in, or the server can't be reached. */
  serverExport(): Promise<ServerExport | null>;
  /** Asks for a server export, replacing a ready one. Needs Confirm it's you first. */
  requestServerExport(): Promise<ServerExportRequest>;
  /** Downloads the ready server export. Needs Confirm it's you within the last few minutes. */
  downloadServerExport(): Promise<ServerExportDownload>;
  /**
   * The local supplement, built from this installation's database with no
   * network: what hasn't reached the account, labeled with device, revision
   * and sync status. It changes nothing (no conflict is resolved, no total
   * moves). Null with no open account database.
   */
  localSupplement(): Promise<LocalSupplement | null>;
}

/** What the export needs from the Account service. */
export interface ExportPorts {
  /** A database operation on the export path; null when the gate denies, the server can't be reached or the account session moved on. */
  operation(name: string): Promise<unknown>;
  /** A GET of a storage object with this session's token; null when no account is signed in or the account session moved on. */
  download(path: string): Promise<Response | null>;
  /** The open account database, when the gate leaves it open for the restricted paths. */
  openStore(): { readonly accountId: string; readonly installationId: string; readonly store: SyncStore & UnfinishedActivities } | null;
  readonly registry: ReadonlyMap<string, RecordType>;
  readonly clock: () => number;
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const instant = (value: unknown): number => (typeof value === 'string' ? Date.parse(value) : Number.NaN);

/** The server's export view as the player sees it; null when it isn't one. */
export function parseServerExport(view: unknown): ServerExport | null {
  if (!isObject(view)) return null;
  const requestedAt = instant(view.requestedAt);
  if (!Number.isFinite(requestedAt)) return null;
  switch (view.state) {
    case 'preparing':
    case 'failed':
    case 'expired':
      return { state: view.state, requestedAt };
    case 'ready': {
      const readyAt = instant(view.readyAt);
      const expiresAt = instant(view.expiresAt);
      if (!Number.isFinite(readyAt) || !Number.isFinite(expiresAt) || typeof view.bytes !== 'number') return null;
      return { state: 'ready', requestedAt, readyAt, expiresAt, bytes: view.bytes };
    }
    case 'invalidated':
      return view.endedBy === 'regenerated' || view.endedBy === 'revocation' || view.endedBy === 'deletion-scheduled' || view.endedBy === 'deleted'
        ? { state: 'ended', requestedAt, by: view.endedBy }
        : null;
    default:
      return null;
  }
}

/** The revision a revisioned upload was made from, when it names one. */
function baseRevision(payload: unknown): number | null {
  return isObject(payload) && typeof payload.base === 'number' ? payload.base : null;
}

export function accountExport(ports: ExportPorts): AccountExport {
  const status = async () => {
    const answer = await ports.operation('export_status_v1');
    if (!isObject(answer) || (answer.status !== 'none' && answer.status !== 'export')) return null;
    const latest: ServerExport | null = answer.status === 'none' ? { state: 'none' } : parseServerExport(answer.export);
    const path = isObject(answer.export) && typeof answer.export.path === 'string' ? answer.export.path : null;
    return latest ? { latest, path, fresh: answer.fresh === true } : null;
  };

  return {
    async serverExport() {
      return (await status())?.latest ?? null;
    },

    async requestServerExport() {
      const answer = await ports.operation('request_export_v1');
      if (!isObject(answer)) return { status: 'failed' };
      if (answer.status === 'fresh-authentication-required') return { status: answer.status };
      const view = parseServerExport(answer.export);
      if ((answer.status === 'requested' || answer.status === 'preparing') && view) return { status: answer.status, export: view };
      return { status: 'failed' };
    },

    async downloadServerExport() {
      const current = await status();
      if (!current) return { status: 'failed' };
      if (current.latest.state !== 'ready' || !current.path) return { status: 'not-ready' };
      if (!current.fresh) return { status: 'fresh-authentication-required' };
      const { readyAt } = current.latest;
      const response = await ports.download(current.path);
      if (!response) return { status: 'failed' };
      if (!response.ok) {
        await response.body?.cancel();
        // Denied: its few minutes passed, or the export ended meanwhile.
        const now = await status();
        if (now && now.latest.state !== 'ready') return { status: 'not-ready' };
        if (now && !now.fresh) return { status: 'fresh-authentication-required' };
        return { status: 'failed' };
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      return { status: 'downloaded', fileName: `tableside-export-${new Date(readyAt).toISOString().slice(0, 10)}.zip`, bytes };
    },

    async localSupplement() {
      const open = ports.openStore();
      if (!open) return null;
      const { store, installationId: installation } = open;
      try {
        const [queue, refused, unfinished] = await Promise.all([store.readUploadQueue(), store.readRejectedUploads(), store.readUnfinishedActivities()]);
        /** An upload made here, as the supplement labels it. */
        const entry = (upload: { readonly recordType: string; readonly payload: unknown }, syncStatus: SupplementStatus, refusal?: string): SupplementEntry => {
          const type = ports.registry.get(upload.recordType);
          return {
            recordType: upload.recordType,
            item: type?.isPayload(upload.payload) ? type.identity.of(upload.payload) : '',
            installation,
            revision: baseRevision(upload.payload),
            syncStatus,
            ...(refusal === undefined ? {} : { refusal }),
            record: upload.payload,
          };
        };
        const unsynced: SupplementEntry[] = [
          ...queue.map((upload) => entry(upload, upload.flagged ? 'flagged' : upload.operation ? 'sending' : 'waiting')),
          ...refused.map((upload) => entry(upload, 'refused', upload.code)),
        ];
        const conflicts: LocalSupplement['conflicts'][number][] = [];
        for (const type of ports.registry.values()) {
          if (type.kind !== 'revisioned-item') continue;
          for (const local of await store.readRevisionedItems(type.name)) {
            const accepted = local.accepted as { revision?: unknown; value?: unknown; conflict?: unknown } | null;
            const conflict = isObject(accepted?.conflict) ? accepted.conflict : null;
            if (!accepted || typeof accepted.revision !== 'number' || !conflict || !Array.isArray(conflict.proposals)) continue;
            conflicts.push({
              recordType: type.name,
              item: local.item,
              acceptedRevision: accepted.revision,
              accepted: accepted.value ?? null,
              proposals: (conflict.proposals as { id: string; kind: string; installation: string; value: unknown }[]).map((proposal) => ({
                recordType: type.name,
                item: local.item,
                installation: proposal.installation,
                revision: accepted.revision as number,
                syncStatus: 'conflict' as const,
                record: { proposal: proposal.id, kind: proposal.kind, value: proposal.value },
              })),
            });
          }
        }
        return {
          format: 'tableside-local-supplement',
          version: 1,
          createdAt: new Date(ports.clock()).toISOString(),
          account: open.accountId,
          installation,
          notice: SUPPLEMENT_NOTICE,
          unsynced,
          conflicts,
          unfinished: unfinished.map((activity) => ({ ...activity, installation, syncStatus: 'unfinished' as const })),
        };
      } catch {
        // The account session ended while reading: its store refuses.
        return null;
      }
    },
  };
}
