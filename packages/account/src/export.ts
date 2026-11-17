// Spec 2 Export, S2-21

import type { RecordType } from './sync/registry';
import type { SyncStore } from './sync/store';
import { instant } from './values';

export type ServerExport =
  | { readonly state: 'none' }
  | { readonly state: 'preparing'; readonly requestedAt: number }
  | { readonly state: 'ready'; readonly requestedAt: number; readonly readyAt: number; readonly expiresAt: number; readonly bytes: number }
  | { readonly state: 'failed'; readonly requestedAt: number }
  | { readonly state: 'expired'; readonly requestedAt: number }
  | { readonly state: 'ended'; readonly requestedAt: number; readonly by: 'regenerated' | 'revocation' | 'deletion-scheduled' | 'deleted' };

type NeedsFresh = { readonly status: 'fresh-authentication-required' };

export type ServerExportRequest =
  | { readonly status: 'requested'; readonly export: ServerExport }
  | { readonly status: 'preparing'; readonly export: ServerExport }
  | NeedsFresh
  | { readonly status: 'failed' };

export type ServerExportDownload =
  | { readonly status: 'downloaded'; readonly fileName: string; readonly bytes: Uint8Array }
  | NeedsFresh
  | { readonly status: 'not-ready' }
  | { readonly status: 'failed' };

export interface UnfinishedActivity {
  readonly activityId: string;
  readonly kind: 'practice-session';
  readonly game: string;
  readonly mode: 'free-play' | 'guided';
  readonly startedAt: number;
  readonly steps: number;
}

export interface UnfinishedActivities {
  readUnfinishedActivities(): Promise<readonly UnfinishedActivity[]>;
}

export type SupplementStatus = 'waiting' | 'sending' | 'flagged' | 'refused' | 'conflict' | 'unfinished';

export interface SupplementEntry {
  readonly recordType: string;
  readonly item: string;
  readonly installation: string;
  readonly revision: number | null;
  readonly syncStatus: SupplementStatus;
  readonly refusal?: string;
  readonly record: unknown;
}

export interface LocalSupplement {
  readonly format: 'tableside-local-supplement';
  readonly version: 1;
  readonly createdAt: string;
  readonly account: string;
  readonly installation: string;
  readonly notice: string;
  readonly unsynced: readonly SupplementEntry[];
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
  serverExport(): Promise<ServerExport | null>;
  requestServerExport(): Promise<ServerExportRequest>;
  downloadServerExport(): Promise<ServerExportDownload>;
  localSupplement(): Promise<LocalSupplement | null>;
}

export interface ExportPorts {
  operation(name: string): Promise<unknown>;
  download(path: string): Promise<Response | null>;
  openStore(): { readonly accountId: string; readonly installationId: string; readonly store: SyncStore & UnfinishedActivities } | null;
  readonly registry: ReadonlyMap<string, RecordType>;
  readonly clock: () => number;
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

export function parseServerExport(view: unknown): ServerExport | null {
  if (!isObject(view)) return null;
  const requestedAt = instant(view.requestedAt);
  if (requestedAt === null) return null;
  switch (view.state) {
    case 'preparing':
    case 'failed':
    case 'expired':
      return { state: view.state, requestedAt };
    case 'ready': {
      const readyAt = instant(view.readyAt);
      const expiresAt = instant(view.expiresAt);
      if (readyAt === null || expiresAt === null || typeof view.bytes !== 'number') return null;
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
        return null;
      }
    },
  };
}
