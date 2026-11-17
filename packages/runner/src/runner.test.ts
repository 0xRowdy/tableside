// Spec 6 Amendment 6
import { BENCHMARK_PROFILES } from '@tableside/definitions';
import { canonicalJson, canonicalStrategy, defaultSelection, STANDARDIZED_STOP_CAUSES, type BenchmarkProfile, type StandardizedSessionRecord, type Words2 } from '@tableside/engine';
import { engineSuite } from '@tableside/engine/test-suite';
import { runSuite } from '@tableside/harness';
import { describe, expect, it } from 'vitest';

import { builtInStrategies, compatibleProfiles, parseKey, runStandardized } from './index';

interface Traced {
  profile: BenchmarkProfile;
  strategy: unknown;
  key: Words2;
  index: number;
  record: StandardizedSessionRecord;
}

function tracedSessions(): Traced[] {
  const suite = { ...engineSuite, cases: engineSuite.cases.filter((c) => c.name.startsWith('standardized: built-in traces')) };
  const [result] = runSuite(suite, { jsEngine: 'node', platform: 'node', version: process.version }).cases;
  expect(result?.status).toBe('pass');
  return (result?.outputs ?? []).map((output) => JSON.parse(output.slice(output.indexOf('=') + 1)) as Traced);
}

describe('headless runner', () => {
  it('reproduces the cross-runtime suite’s sessions with the shipped built-ins and profiles', () => {
    const builtIns = new Map(builtInStrategies().map((definition) => [canonicalJson(canonicalStrategy(defaultSelection(definition))), definition]));
    let replayed = 0;
    for (const traced of tracedSessions()) {
      const definition = builtIns.get(canonicalJson(traced.strategy));
      if (!definition) continue;
      const profile = BENCHMARK_PROFILES.find((p) => p.id === traced.profile.id);
      expect(profile).toEqual(traced.profile);
      expect(runStandardized({ profile: profile as BenchmarkProfile, strategy: defaultSelection(definition), key: traced.key, indices: [traced.index] })).toEqual([traced.record]);
      replayed++;
    }
    expect(replayed).toBe((5 * 2 + 5 + 2) * 2);
  }, 120_000);

  it('runs every built-in strategy on every profile it fits, with complete, bounded records', () => {
    const key = parseKey('0123456789abcdef');
    for (const definition of builtInStrategies()) {
      const profiles = compatibleProfiles(defaultSelection(definition));
      expect(profiles.length, definition.id).toBeGreaterThan(0);
      for (const profile of profiles) {
        const records = runStandardized({ profile, strategy: defaultSelection(definition), key, indices: [0, 1] });
        for (const record of records) {
          expect(STANDARDIZED_STOP_CAUSES).toContain(record.stopCause);
          expect(record.opportunities).toBeLessThanOrEqual(200);
          expect(record.resolved).toBe(record.wins + record.losses + record.pushes);
          expect(BigInt(record.net)).toBe(BigInt(record.finalBalance) - 1000n);
          expect(record.literalZero).toBe(record.finalBalance === '0');
        }
        expect(runStandardized({ profile, strategy: defaultSelection(definition), key, indices: [1] })).toEqual([records[1]]);
        expect(records[0]).not.toEqual({ ...records[1], index: 0 });
      }
    }
  }, 120_000);

  it('reads the coordinator’s key as 16 hex digits, low word first', () => {
    expect(parseKey('9e3779b97f4a7c15')).toEqual([0x7f4a7c15, 0x9e3779b9]);
    expect(() => parseKey('xyz')).toThrow(RangeError);
  });

  it('refuses a profile whose exposure bound fails validation before running any session', () => {
    const profile = { ...(BENCHMARK_PROFILES[6] as BenchmarkProfile), exposureBound: '999' };
    const definition = builtInStrategies()[0];
    expect(() => runStandardized({ profile, strategy: { definition: definition as never, parameters: {} }, key: [0, 0], indices: [0] })).toThrow(/exposure bound/);
  });
});
