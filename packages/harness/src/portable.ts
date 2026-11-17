// docs/cross-runtime-harness.md How it works

export interface Runtime {
  jsEngine: 'node' | 'hermes' | 'other';
  platform: 'node' | 'ios' | 'android' | 'other';
  version: string;
}

export interface TestContext {
  equal(actual: unknown, expected: unknown): void;
  record(label: string, value: unknown): void;
}

export interface TestCase {
  name: string;
  run(t: TestContext): void;
}

export interface Suite {
  name: string;
  cases: readonly TestCase[];
}

export interface CaseResult {
  name: string;
  status: 'pass' | 'fail';
  error?: string;
  outputs: string[];
}

export interface Report {
  formatVersion: 1;
  suite: string;
  runtime: Runtime;
  cases: CaseResult[];
}

export function runSuite(suite: Suite, runtime: Runtime): Report {
  return {
    formatVersion: 1,
    suite: suite.name,
    runtime,
    cases: suite.cases.map(runCase),
  };
}

function runCase(testCase: TestCase): CaseResult {
  const outputs: string[] = [];
  const context: TestContext = {
    equal(actual, expected) {
      const a = canonicalJson(actual);
      const e = canonicalJson(expected);
      if (a !== e) throw new ExpectationError(`expected ${e} but got ${a}`);
    },
    record(label, value) {
      outputs.push(`${label}=${canonicalJson(value)}`);
    },
  };
  try {
    testCase.run(context);
    return { name: testCase.name, status: 'pass', outputs };
  } catch (error) {
    return { name: testCase.name, status: 'fail', error: describeError(error), outputs };
  }
}

class ExpectationError extends Error {}

function describeError(error: unknown): string {
  if (error instanceof ExpectationError) return error.message;
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

export function canonicalJson(value: unknown): string {
  switch (typeof value) {
    case 'string':
    case 'boolean':
      return JSON.stringify(value);
    case 'number':
      if (!Number.isFinite(value)) throw new TypeError(`cannot encode non-finite number ${value}`);
      return JSON.stringify(Object.is(value, -0) ? 0 : value);
    case 'bigint':
      return `{"$bigint":${JSON.stringify(value.toString())}}`;
    case 'object': {
      if (value === null) return 'null';
      if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
      const prototype = Object.getPrototypeOf(value) as unknown;
      if (prototype !== Object.prototype && prototype !== null) {
        throw new TypeError('cannot encode a class instance');
      }
      const record = value as Record<string, unknown>;
      const keys = Object.keys(record).sort();
      return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
    }
    default:
      throw new TypeError(`cannot encode ${typeof value}`);
  }
}
