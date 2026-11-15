// The Account service's records (spec 2, *Revisioned items, conflicts,
// tombstones and totals*): revisioned items as this installation shows them,
// their conflicts' resolution, and lifetime totals. Spec 4's casino sessions
// and private strategies build their screens on these.
//
// - Account totals count what the account accepted, each record's accepted
//   version once: a conflict's baseline, never its proposals, and nothing for
//   a tombstone. A pending edit of an accepted record is in no total.
// - Records saved here that the account hasn't accepted yet are labelled local,
//   and summed apart.

import type { Resolution, ResolutionOutcome, SyncEngine } from './engine';
import type { Contribution, RecordType, RevisionedState } from './registry';
import type { SyncStore } from './store';
import { type TotalsRow, sumContributions } from './totals';

/** A revisioned item as this installation shows it. */
export interface RevisionedItemView {
  readonly item: string;
  /**
   * local: saved on this installation only; the account hasn't received it, and no account total counts it.
   * pending: the account has the item, and a change made here awaits the account.
   * accepted: as the account accepted it.
   */
  readonly status: 'local' | 'pending' | 'accepted';
  /** What this installation shows: its own latest change while local or pending, else the accepted value. null: deleted. */
  readonly value: unknown;
  /** The account's accepted state, with any open conflict: what account totals count. */
  readonly accepted: RevisionedState<unknown> | null;
}

export interface AccountTotals {
  /** What the account accepted. */
  readonly account: readonly TotalsRow[];
  /** Records saved on this installation that the account hasn't accepted yet, labelled local. */
  readonly local: readonly TotalsRow[];
}

export type ResolutionResult =
  | { readonly status: Exclude<ResolutionOutcome, 'conflict-changed'> }
  /** The conflict changed after it was reviewed: the item as it now is, to review again. */
  | { readonly status: 'conflict-changed'; readonly item: RevisionedItemView | null };

export interface AccountRecords {
  /** Saves a revisioned item on this installation (new or edited); it uploads by itself. */
  save(recordType: string, item: string, value: unknown): Promise<void>;
  /** Deletes a revisioned item on this installation; it uploads by itself. */
  delete(recordType: string, item: string): Promise<void>;
  /** Every revisioned item of a type on this installation, deleted ones included (their recovery proposals need review). */
  revisionedItems(recordType: string): Promise<readonly RevisionedItemView[]>;
  /** Resolves an open conflict. Needs the network: nothing is queued. */
  resolve(recordType: string, item: string, resolution: Resolution): Promise<ResolutionResult>;
  totals(): Promise<AccountTotals>;
}

/** The open account session's store and sync engine, or null when no account is open. */
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

    async totals() {
      const { store } = session();
      const account: Contribution[] = [];
      const local: Contribution[] = [];
      const add = (into: Contribution[], contribution: Contribution | null) => contribution && into.push(contribution);
      const queue = await store.readUploadQueue();
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
          for (const record of accepted) add(account, contribute(record.payload));
          for (const entry of queue) {
            if (entry.recordType !== type.name || !type.isPayload(entry.payload) || items.has(type.identity.of(entry.payload))) continue;
            add(local, contribute(entry.payload));
          }
        }
      }
      return { account: sumContributions(account), local: sumContributions(local) };
    },
  };
}
