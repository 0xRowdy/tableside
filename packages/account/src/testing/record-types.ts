// Test-only record types: the client half of supabase/seed/test-record-types.sql
// (local stacks only). Seam 2 proves the platform's behavior for each kind
// with these, so the specs that register real types inherit it and test only
// their own rules. Never registered in a build.

import { type RecordType, isMoney, recordTypes, revisionedItemType } from '../sync/registry';

/** A revisioned item shaped like a small casino session: a game, a real currency and an exact net result. */
export interface TestRevisionedValue {
  readonly game: string;
  readonly currency: string;
  readonly net: string;
}


export const testRevisionedItem = revisionedItemType<TestRevisionedValue>({
  name: 'test-revisioned-item',
  payloadVersion: 1,
  identityScheme: 'random-id',
  acceptance: 'private.accept_test_revisioned_item_v1',
  isValue(value): value is TestRevisionedValue {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
    const { game, currency, net, ...rest } = value as Record<string, unknown>;
    return Object.keys(rest).length === 0 && typeof game === 'string' && typeof currency === 'string' && /^[A-Z]{3}$/.test(currency) && isMoney(net);
  },
  contribution: (value) => ({ total: 'casino', game: value.game, currency: value.currency, amount: value.net }),
  export: { csv: null, json: (state) => state },
  // Its rows are in the platform's revisioned item tables (PLATFORM_TABLES).
  deletion: { serverTables: [] },
});

/** This build's record types and the test-only ones. */
export const testRecordTypes: ReadonlyMap<string, RecordType> = new Map<string, RecordType>([
  ...recordTypes,
  [testRevisionedItem.name, testRevisionedItem as unknown as RecordType],
]);
