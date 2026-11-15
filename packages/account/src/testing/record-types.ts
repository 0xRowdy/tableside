// Test-only record types (seam 2, spec 2 *Testing Decisions › Registry*): one
// of each registry kind and rule, standing in for later specs' types, so specs
// 3–6 inherit proven platform behaviour and test only their own rules. The
// server half is record-types.sql, which the harness installs on the local
// stack only; no build of the app registers these.

import { readFileSync } from 'node:fs';

import { type RecordType, recordTypes } from '../sync/registry';
import type { LocalStack } from './stack';

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const hasStrings = (value: unknown, ...keys: string[]): value is Record<string, string> =>
  isObject(value) && value.version === 1 && keys.every((key) => typeof value[key] === 'string');

/** The payload a `{ record }` change carries, when it is the type's. */
function recordOf<P>(type: RecordType<P>): (change: unknown) => P | null {
  return (change) => {
    const record = isObject(change) ? change.record : undefined;
    return type.isPayload(record) ? record : null;
  };
}

/** A test type with the platform defaults: no barriers, contribution, export or deletion beyond its own tables. */
function testType<P>(
  fields: Pick<RecordType<P>, 'name' | 'kind' | 'isPayload' | 'barriers'> & {
    readonly id: keyof P & string;
    readonly tables: readonly string[];
  } & Partial<Pick<RecordType<P>, 'affectedBy' | 'ordering' | 'purges' | 'fromChange'>>,
): RecordType<P> {
  const { id, tables, ...rest } = fields;
  const type: RecordType<P> = {
    payloadVersion: 1,
    identity: { scheme: id, of: (payload) => String(payload[id]) },
    acceptance: fields.kind === 'server-authored-state' ? null : `private.accept_${fields.name.replaceAll('-', '_')}_v1`,
    fromChange: (change) => recordOf(type)(change),
    contribution: null,
    export: { csv: null, json: (payload) => payload },
    deletion: { serverTables: tables },
    ...rest,
  };
  return type;
}

export interface TestWithdrawal {
  readonly version: 1;
  readonly withdrawalId: string;
  /** Which contributions it covers. */
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
  /** What it adds to the account total. */
  readonly amount: number;
  /** Its detail, kept apart from its summary on the server. */
  readonly detail: string;
}
export interface TestResultPurge {
  readonly version: 1;
  readonly target: string;
}
export interface TestAttempt {
  readonly version: 1;
  readonly attemptId: string;
  readonly passed: boolean;
  /** The device clock when it was made: displayed, never used for order. */
  readonly at: number;
}
export interface TestExperimentAssignment {
  readonly version: 1;
  readonly experiment: string;
  readonly group: string;
}

/** Spec 6's sharing withdrawal: works offline, and holds the contributions it covers until acknowledged. */
export const testSharingWithdrawal = testType<TestWithdrawal>({
  name: 'test-sharing-withdrawal',
  kind: 'account-state-operation',
  id: 'withdrawalId',
  isPayload: (value): value is TestWithdrawal => hasStrings(value, 'withdrawalId', 'scope'),
  barriers: [],
  tables: ['private.test_sharing_withdrawals'],
});

/** Spec 6's public contribution: behind any pending withdrawal of its scope. */
export const testContribution = testType<TestContribution>({
  name: 'test-contribution',
  kind: 'account-state-operation',
  id: 'contributionId',
  isPayload: (value): value is TestContribution => hasStrings(value, 'contributionId', 'scope'),
  barriers: [testSharingWithdrawal.name],
  affectedBy: (barrier, payload) => (barrier.payload as TestWithdrawal).scope === payload.scope,
  tables: ['private.test_contributions'],
});

/** Spec 5's allowance reconciliation: the original device's report on a grant. */
export const testAllowanceReconciliation = testType<TestReconciliation>({
  name: 'test-allowance-reconciliation',
  kind: 'account-state-operation',
  id: 'reconciliationId',
  isPayload: (value): value is TestReconciliation => hasStrings(value, 'reconciliationId', 'grant'),
  barriers: [],
  tables: ['private.test_reconciliations'],
});

/** Spec 5's transfer request: behind any unresolved reconciliation of its grant. */
export const testAllowanceTransfer = testType<TestTransfer>({
  name: 'test-allowance-transfer',
  kind: 'account-state-operation',
  id: 'transferId',
  isPayload: (value): value is TestTransfer => hasStrings(value, 'transferId', 'grant'),
  barriers: [testAllowanceReconciliation.name],
  affectedBy: (barrier, payload) => (barrier.payload as TestReconciliation).grant === payload.grant,
  tables: ['private.test_transfers'],
});

/** An immutable result with a summary, a detail and a contribution: what a purge removes. */
export const testResult = testType<TestResult>({
  name: 'test-result',
  kind: 'immutable-result',
  id: 'resultId',
  isPayload: (value): value is TestResult =>
    hasStrings(value, 'resultId', 'detail') && typeof value.amount === 'number' && Number.isSafeInteger(value.amount),
  barriers: [],
  tables: ['private.test_results', 'private.test_result_details', 'private.test_totals'],
});

/** Spec 4's practice-session deletion: purges an accepted result. Its barrier is the target's acceptance. */
export const testResultPurge = testType<TestResultPurge>({
  name: 'test-result-purge',
  kind: 'account-state-operation',
  id: 'target',
  isPayload: (value): value is TestResultPurge => hasStrings(value, 'target'),
  barriers: [],
  purges: (payload) => ({ recordType: testResult.name, item: payload.target }),
  // The server's change names what it purged, not the operation's payload.
  fromChange(change) {
    const purge = isObject(change) && isObject(change.purge) ? change.purge : undefined;
    return purge && purge.recordType === testResult.name && typeof purge.item === 'string' ? { version: 1, target: purge.item } : null;
  },
  tables: [],
});

/** Spec 3's challenge attempt: per-device, ordered by its originating installation's positions. */
export const testAttempt = testType<TestAttempt>({
  name: 'test-attempt',
  kind: 'immutable-result',
  id: 'attemptId',
  isPayload: (value): value is TestAttempt => hasStrings(value, 'attemptId') && typeof value.passed === 'boolean' && typeof value.at === 'number',
  barriers: [],
  ordering: 'per-device',
  tables: ['private.test_attempts'],
});

/** Spec 5's experiment assignment: server-authored state, which no client writes. */
export const testExperimentAssignment = testType<TestExperimentAssignment>({
  name: 'test-experiment-assignment',
  kind: 'server-authored-state',
  id: 'experiment',
  isPayload: (value): value is TestExperimentAssignment => hasStrings(value, 'experiment', 'group'),
  barriers: [],
  tables: ['private.test_experiment_assignments'],
});

export const TEST_RECORD_TYPES: readonly RecordType[] = [
  testSharingWithdrawal,
  testContribution,
  testAllowanceReconciliation,
  testAllowanceTransfer,
  testResult,
  testResultPurge,
  testAttempt,
  testExperimentAssignment,
] as RecordType[];

/** The app's registry with the test-only types added. */
export const testRegistry: ReadonlyMap<string, RecordType> = new Map([...recordTypes, ...TEST_RECORD_TYPES.map((type) => [type.name, type] as const)]);

const installed = new WeakMap<LocalStack, Promise<void>>();

/** Registers the test-only types' server half on the local stack, once per stack (idempotent across runs). */
export function installTestRecordTypes(stack: LocalStack): Promise<void> {
  let installing = installed.get(stack);
  if (!installing) {
    const script = readFileSync(new URL('./record-types.sql', import.meta.url), 'utf8');
    installing = stack.sql.unsafe(script).simple().then(() => undefined);
    installed.set(stack, installing);
  }
  return installing;
}
