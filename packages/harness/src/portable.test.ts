import { describe, expect, it } from 'vitest';

import { runSuite, type Runtime } from './portable';

const node: Runtime = { jsEngine: 'node', platform: 'node', version: 'v24.0.0' };

describe('runSuite', () => {
  it('reports each case in order with its recorded outputs', () => {
    const report = runSuite(
      {
        name: 'engine',
        cases: [
          { name: 'adds', run: (t) => t.record('sum', 2 + 3) },
          { name: 'big', run: (t) => t.record('product', 2n ** 70n) },
        ],
      },
      node,
    );

    expect(report).toEqual({
      formatVersion: 1,
      suite: 'engine',
      runtime: node,
      cases: [
        { name: 'adds', status: 'pass', outputs: ['sum=5'] },
        { name: 'big', status: 'pass', outputs: ['product={"$bigint":"1180591620717411303424"}'] },
      ],
    });
  });

  it('records outputs canonically so key order does not matter', () => {
    const report = runSuite(
      { name: 's', cases: [{ name: 'obj', run: (t) => t.record('v', { b: 1, a: [true, null, 'x'] }) }] },
      node,
    );

    expect(report.cases[0]?.outputs).toEqual(['v={"a":[true,null,"x"],"b":1}']);
  });

  it('fails a case whose expectation does not hold and keeps running the rest', () => {
    const report = runSuite(
      {
        name: 's',
        cases: [
          { name: 'wrong', run: (t) => t.equal({ n: 1 }, { n: 2 }) },
          { name: 'right', run: (t) => t.equal([1n], [1n]) },
        ],
      },
      node,
    );

    expect(report.cases.map((c) => [c.name, c.status])).toEqual([
      ['wrong', 'fail'],
      ['right', 'pass'],
    ]);
    expect(report.cases[0]?.error).toBe('expected {"n":2} but got {"n":1}');
  });

  it('fails a case that throws, keeping outputs recorded before the throw', () => {
    const report = runSuite(
      {
        name: 's',
        cases: [
          {
            name: 'throws',
            run: (t) => {
              t.record('before', 1);
              throw new RangeError('boom');
            },
          },
        ],
      },
      node,
    );

    expect(report.cases[0]).toEqual({ name: 'throws', status: 'fail', error: 'RangeError: boom', outputs: ['before=1'] });
  });

  it('rejects values that do not serialize the same way on every runtime', () => {
    const report = runSuite(
      {
        name: 's',
        cases: [
          { name: 'nan', run: (t) => t.record('v', Number.NaN) },
          { name: 'undef', run: (t) => t.record('v', { a: undefined }) },
        ],
      },
      node,
    );

    expect(report.cases.map((c) => c.status)).toEqual(['fail', 'fail']);
  });
});
