import { type RecordType, isMoney, recordTypes, revisionedItemType } from '../sync/registry';

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
  deletion: { serverTables: [] },
});

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const hasStrings = (value: unknown, ...keys: string[]): value is Record<string, string> =>
  isObject(value) && value.version === 1 && keys.every((key) => typeof value[key] === 'string');

function recordOf<P>(type: RecordType<P>): (change: unknown) => P | null {
  return (change) => {
    const record = isObject(change) ? change.record : undefined;
    return type.isPayload(record) ? record : null;
  };
}

function testType<P>(
  fields: Pick<RecordType<P>, 'name' | 'kind' | 'isPayload' | 'barriers'> & {
    readonly id: keyof P & string;
    readonly tables: readonly string[];
  } & Partial<Pick<RecordType<P>, 'affectedBy' | 'afterReconciliation' | 'ordering' | 'purges' | 'fromChange' | 'contribution' | 'snapshot' | 'detail'>>,
): RecordType<P> {
  const { id, tables, ...rest } = fields;
  const type: RecordType<P> = {
    payloadVersion: 1,
    identity: { scheme: id, of: (payload) => String(payload[id]) },
    acceptance: fields.kind === 'server-authored-state' ? null : `private.accept_${fields.name.replaceAll('-', '_')}_v1`,
    fromChange: (change) => recordOf(type)(change),
    contribution: null,
    snapshot: null,
    export: { csv: null, json: (payload) => payload },
    deletion: { serverTables: tables },
    ...rest,
  };
  return type;
}

export interface TestSharingWithdrawal {
  readonly version: 1;
  readonly sharingWithdrawalId: string;
  readonly scope: string;
}
export interface TestSharingEnable {
  readonly version: 1;
  readonly sharingEnableId: string;
  readonly scope: string;
}
export interface TestContribution {
  readonly version: 1;
  readonly contributionId: string;
  readonly scope: string;
}
export interface TestReconciliation {
  readonly version: 1;
  readonly reconciliationId: string;
  readonly grant: string;
}
export interface TestTransfer {
  readonly version: 1;
  readonly transferId: string;
  readonly grant: string;
}
export interface TestResult {
  readonly version: 1;
  readonly resultId: string;
  readonly amount: string;
  readonly detail: string;
  readonly at?: number;
}
export interface TestResultPurge {
  readonly version: 1;
  readonly target: string;
}
export interface TestAttempt {
  readonly version: 1;
  readonly attemptId: string;
  readonly passed: boolean;
  readonly at: number;
}
export interface TestExperimentAssignment {
  readonly version: 1;
  readonly experiment: string;
  readonly group: string;
}

export const testSharingWithdrawal = testType<TestSharingWithdrawal>({
  name: 'test-sharing-withdrawal',
  kind: 'account-state-operation',
  id: 'sharingWithdrawalId',
  isPayload: (value): value is TestSharingWithdrawal => hasStrings(value, 'sharingWithdrawalId', 'scope'),
  barriers: [],
  tables: ['private.test_sharing_withdrawals'],
});

// #98
export const testSharingEnable = testType<TestSharingEnable>({
  name: 'test-sharing-enable',
  kind: 'account-state-operation',
  id: 'sharingEnableId',
  isPayload: (value): value is TestSharingEnable => hasStrings(value, 'sharingEnableId', 'scope'),
  barriers: [],
  tables: [],
});

export const testContribution = testType<TestContribution>({
  name: 'test-contribution',
  kind: 'account-state-operation',
  id: 'contributionId',
  isPayload: (value): value is TestContribution => hasStrings(value, 'contributionId', 'scope'),
  barriers: [testSharingWithdrawal.name],
  afterReconciliation: true,
  affectedBy: (barrier, payload) => (barrier.payload as TestSharingWithdrawal).scope === payload.scope,
  tables: ['private.test_contributions'],
});

export const testAllowanceReconciliation = testType<TestReconciliation>({
  name: 'test-allowance-reconciliation',
  kind: 'account-state-operation',
  id: 'reconciliationId',
  isPayload: (value): value is TestReconciliation => hasStrings(value, 'reconciliationId', 'grant'),
  barriers: [],
  tables: ['private.test_reconciliations'],
});

export const testAllowanceTransfer = testType<TestTransfer>({
  name: 'test-allowance-transfer',
  kind: 'account-state-operation',
  id: 'transferId',
  isPayload: (value): value is TestTransfer => hasStrings(value, 'transferId', 'grant'),
  barriers: [testAllowanceReconciliation.name],
  afterReconciliation: true,
  affectedBy: (barrier, payload) => (barrier.payload as TestReconciliation).grant === payload.grant,
  tables: ['private.test_transfers'],
});

export const testResult = testType<TestResult>({
  name: 'test-result',
  kind: 'immutable-result',
  id: 'resultId',
  isPayload: (value): value is TestResult => hasStrings(value, 'resultId', 'detail') && isMoney(value.amount),
  barriers: [],
  contribution: (result) => ({ total: 'practice', game: 'test', currency: 'simulated', amount: result.amount }),
  snapshot: 'private.snapshot_test_results',
  detail: { server: 'private.detail_test_results', complete: (result) => typeof result.detail === 'string', at: (result) => result.at ?? 0 },
  fromChange(change) {
    const record = isObject(change) ? change.record : undefined;
    return hasStrings(record, 'resultId') &&
      isMoney(record.amount) &&
      (record.detail === undefined || typeof record.detail === 'string') &&
      (record.at === undefined || Number.isSafeInteger(record.at))
      ? (record as unknown as TestResult)
      : null;
  },
  tables: ['private.test_results', 'private.test_result_details'],
});

export const testResultPurge = testType<TestResultPurge>({
  name: 'test-result-purge',
  kind: 'account-state-operation',
  id: 'target',
  isPayload: (value): value is TestResultPurge => hasStrings(value, 'target'),
  barriers: [],
  purges: (payload) => ({ recordType: testResult.name, item: payload.target }),
  fromChange(change) {
    const purge = isObject(change) && isObject(change.purge) ? change.purge : undefined;
    return purge && purge.recordType === testResult.name && typeof purge.item === 'string' ? { version: 1, target: purge.item } : null;
  },
  tables: [],
});

export const testAttempt = testType<TestAttempt>({
  name: 'test-attempt',
  kind: 'immutable-result',
  id: 'attemptId',
  isPayload: (value): value is TestAttempt => hasStrings(value, 'attemptId') && typeof value.passed === 'boolean' && typeof value.at === 'number',
  barriers: [],
  ordering: 'per-device',
  snapshot: 'private.snapshot_test_attempts',
  tables: ['private.test_attempts'],
});

export const testExperimentAssignment = testType<TestExperimentAssignment>({
  name: 'test-experiment-assignment',
  kind: 'server-authored-state',
  id: 'experiment',
  isPayload: (value): value is TestExperimentAssignment => hasStrings(value, 'experiment', 'group'),
  barriers: [],
  snapshot: 'private.snapshot_test_experiment_assignments',
  tables: ['private.test_experiment_assignments'],
});

export interface TestStrategyRevision {
  readonly version: 1;
  readonly revisionId: string;
  readonly strategy: string;
  readonly executable: string;
}

// Spec 2 Amendment 4 §3, Amendment 7 §3
export const testStrategyRevision = testType<TestStrategyRevision>({
  name: 'test-strategy-revision',
  kind: 'immutable-result',
  id: 'revisionId',
  isPayload: (value): value is TestStrategyRevision => hasStrings(value, 'revisionId', 'strategy', 'executable'),
  barriers: [],
  snapshot: 'private.snapshot_test_strategy_revisions',
  tables: ['private.test_strategy_revisions'],
});

export const TEST_RECORD_TYPES: readonly RecordType[] = [
  testSharingWithdrawal,
  testSharingEnable,
  testContribution,
  testAllowanceReconciliation,
  testAllowanceTransfer,
  testResult,
  testResultPurge,
  testAttempt,
  testExperimentAssignment,
  testStrategyRevision,
] as RecordType[];

export const testRecordTypes: ReadonlyMap<string, RecordType> = new Map<string, RecordType>([
  ...recordTypes,
  [testRevisionedItem.name, testRevisionedItem as unknown as RecordType],
  ...TEST_RECORD_TYPES.map((type) => [type.name, type] as const),
]);
