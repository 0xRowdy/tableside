// Spec 3 Comparison groups (Readiness streak); Testing Decisions › Seam 2; #148, #53
import type { AssistanceClass, AttemptEndingReason, ChallengeMetric, ChallengeMetrics, ChallengeVariant, MetricResult } from '@tableside/engine';
import { describe, expect, it } from 'vitest';

import { readinessStreakEffect } from '../src';
import { localStack } from '../src/testing';

const stack = localStack();

const NO_METRICS: ChallengeMetrics = { 'card-values': null, 'running-count': null, 'true-count': null, 'playing-adherence': null, 'betting-adherence': null };

function attempt(variant: ChallengeVariant, assistanceClass: AssistanceClass, endingReason: AttemptEndingReason, scores: Partial<Record<ChallengeMetric, MetricResult>> = {}) {
  return { groupKey: { variant, assistanceClass } as never, endingReason, metrics: { ...NO_METRICS, ...scores } };
}

const of = (correct: number, total: number): MetricResult => ({ correct, total });

const FIXTURES = [
  ['Learn, perfect', attempt('learn', 'learn', 'completed', { 'running-count': of(20, 20) }), 'neutral'],
  ['unassisted Check at exactly 95%', attempt('check', 'unassisted-check', 'completed', { 'running-count': of(19, 20) }), 'advances'],
  ['unassisted Check just under 95%', attempt('check', 'unassisted-check', 'completed', { 'running-count': of(18, 20) }), 'breaks'],
  ['assisted Check, perfect', attempt('check', 'assisted-check', 'completed', { 'running-count': of(20, 20) }), 'neutral'],
  ['abandoned assisted Check', attempt('check', 'assisted-check', 'abandoned', { 'running-count': of(4, 4) }), 'breaks'],
  ['abandoned unassisted Check', attempt('check', 'unassisted-check', 'abandoned'), 'breaks'],
  ['insufficient-funds Check', attempt('check', 'assisted-check', 'insufficient-funds', { 'running-count': of(9, 9), 'true-count': of(9, 9) }), 'breaks'],
  ['unusable Check', attempt('check', 'unassisted-check', 'unusable'), 'neutral'],
  ['abandoned Learn', attempt('learn', 'learn', 'abandoned'), 'neutral'],
  ['table: running passes, true count under 95%', attempt('check', 'unassisted-check', 'completed', { 'running-count': of(20, 20), 'true-count': of(18, 20) }), 'breaks'],
  ['table: both counts at 95% or more', attempt('check', 'unassisted-check', 'completed', { 'running-count': of(20, 20), 'true-count': of(19, 20) }), 'advances'],
  ['adherence is ignored', attempt('check', 'unassisted-check', 'completed', { 'running-count': of(14, 14), 'playing-adherence': of(0, 10), 'betting-adherence': of(0, 10) }), 'advances'],
  ['an untested metric is ignored', attempt('check', 'unassisted-check', 'completed', { 'card-values': of(0, 0), 'true-count': of(10, 10) }), 'advances'],
  ['no counting metric tested', attempt('check', 'unassisted-check', 'completed', { 'playing-adherence': of(10, 10) }), 'breaks'],
] as const;

describe('the readiness streak rule', () => {
  it('gives the same advance, break or neutral result on the device and on the server', async () => {
    const results = await Promise.all(
      FIXTURES.map(async ([name, fixture]) => {
        const [row] = await stack.sql<{ effect: string }[]>`select private.readiness_streak_effect(${stack.sql.json(fixture as never)}) as effect`;
        return [name, readinessStreakEffect(fixture), row?.effect];
      }),
    );
    expect(results).toEqual(FIXTURES.map(([name, , expected]) => [name, expected, expected]));
  });
});
