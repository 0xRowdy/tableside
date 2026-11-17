// Spec 2 Revisioned items, conflicts, tombstones and totals

import type { DetailResult, Resolution, ResolutionOutcome, SyncEngine } from './engine';
import type { Contribution, RecordType, RevisionedState } from './registry';
import type { SyncStore } from './store';
import { type TotalsRow, sumContributions } from './totals';

export interface RevisionedItemView {
  readonly item: string;
  readonly status: 'local' | 'pending' | 'accepted';
  readonly value: unknown;
  readonly accepted: RevisionedState<unknown> | null;
}

export interface AccountTotals {
  readonly account: readonly TotalsRow[];
  readonly local: readonly TotalsRow[];
}

export type ResolutionResult =
  | { readonly status: Exclude<ResolutionOutcome, 'conflict-changed'> }
  | { readonly status: 'conflict-changed'; readonly item: RevisionedItemView | null };

export interface AccountRecords {
  save(recordType: string, item: string, value: unknown): Promise<void>;
  delete(recordType: string, item: string): Promise<void>;
  revisionedItems(recordType: string): Promise<readonly RevisionedItemView[]>;
  resolve(recordType: string, item: string, resolution: Resolution): Promise<ResolutionResult>;
  totals(): Promise<AccountTotals>;
  // Spec 2 History
  detail(recordType: string, item: string): Promise<DetailResult>;
}

export type OpenSession = () => { readonly store: SyncStore; readonly engine: SyncEngine } | null;

export class NoOpenAccountError extends Error {
  constructor() {
    super('no account is open on this installation');
    this.name = 'NoOpenAccountError';
  }
}

export function accountRecords(open: OpenSession, registry: ReadonlyMap<string, RecordType>): AccountRecords {
  const session = () => {
    const current = open();
    if (!current) throw new NoOpenAccountError();
    return current;
  };
  const revisioned = (recordType: string): RecordType => {
    const type = registry.get(recordType);
    if (type?.kind !== 'revisioned-item') throw new TypeError(`${recordType} is not a registered revisioned item type`);
    return type;
  };

  const views = async (recordType: string): Promise<RevisionedItemView[]> => {
    revisioned(recordType);
    return (await session().store.readRevisionedItems(recordType)).map(({ item, accepted, change, onAccount }) => {
      const state = accepted as RevisionedState<unknown> | null;
      return {
        item,
        status: !onAccount ? 'local' : change ? 'pending' : 'accepted',
        value: change ? change.value : (state?.value ?? null),
        accepted: state,
      };
    });
  };

  return {
    async save(recordType, item, value) {
      if (value === null || !revisioned(recordType).isPayload({ item, action: 'save', base: 0, value })) {
        throw new TypeError(`not a ${recordType} value`);
      }
      await session().store.writeRevisionedItem(recordType, item, value);
    },

    async delete(recordType, item) {
      revisioned(recordType);
      await session().store.writeRevisionedItem(recordType, item, null);
    },

    revisionedItems: views,

    async resolve(recordType, item, resolution) {
      revisioned(recordType);
      const status = await session().engine.resolve(recordType, item, resolution);
      if (status !== 'conflict-changed') return { status };
      return { status, item: (await views(recordType)).find((view) => view.item === item) ?? null };
    },

    async detail(recordType, item) {
      const current = open();
      return current ? current.engine.detail(recordType, item) : { status: 'offline' };
    },

    async totals() {
      const { store } = session();
      const account: Contribution[] = [];
      const local: Contribution[] = [];
      const add = (into: Contribution[], contribution: Contribution | null) => contribution && into.push(contribution);
      const queue = await store.readUploadQueue();
      const bootstrap = await store.readBootstrap();
      const baseline = !bootstrap.installed ? bootstrap.staging : null;
      const purging = new Set(
        queue.flatMap((entry) => {
          const target = registry.get(entry.recordType)?.purges?.(entry.payload);
          return target ? [`${target.recordType}/${target.item}`] : [];
        }),
      );
      for (const type of registry.values()) {
        const contribute = type.contribution;
        if (!contribute) continue;
        if (type.kind === 'revisioned-item') {
          for (const { accepted, change, onAccount } of await store.readRevisionedItems(type.name)) {
            if (accepted !== null) add(account, contribute(accepted));
            else if (!onAccount && change && change.value !== null) {
              add(local, contribute({ revision: 0, deleted: false, value: change.value, conflict: null } satisfies RevisionedState<unknown>));
            }
          }
        } else {
          const accepted = await store.readAcceptedRecords(type.name);
          const items = new Set(accepted.map((record) => record.item));
          for (const record of accepted) if (!baseline || record.sequence > baseline.watermark) add(account, contribute(record.payload));
          for (const entry of queue) {
            if (entry.recordType !== type.name || !type.isPayload(entry.payload)) continue;
            const item = type.identity.of(entry.payload);
            if (items.has(item) || purging.has(`${type.name}/${item}`)) continue;
            add(local, contribute(entry.payload));
          }
        }
      }
      return { account: sumContributions(account, baseline?.totals), local: sumContributions(local) };
    },
  };
}
