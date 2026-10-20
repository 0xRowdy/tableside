import { describe, expect, it } from 'vitest';

import { compareReports, LAUNCH_LEGS } from './compare';
import type { CaseResult, Report, Runtime } from './portable';

const NODE: Runtime = { jsEngine: 'node', platform: 'node', version: 'v24.22.0' };
const IOS: Runtime = { jsEngine: 'hermes', platform: 'ios', version: 'Hermes 0.88 / iOS 26.2' };
const ANDROID: Runtime = { jsEngine: 'hermes', platform: 'android', version: 'Hermes 0.88 / Android 35' };

const passing = (name: string, ...outputs: string[]): CaseResult => ({ name, status: 'pass', outputs });

function report(runtime: Runtime, cases: CaseResult[]): Report {
  return { formatVersion: 1, suite: 'engine', runtime, cases };
}

const agreed = [passing('money', 'sum=5'), passing('random', 'draw=17')];

describe('compareReports', () => {
  it('accepts three launch runtimes that pass every case with identical outputs', () => {
    const verdict = compareReports([report(NODE, agreed), report(IOS, agreed), report(ANDROID, agreed)], {
      requiredLegs: LAUNCH_LEGS,
    });

    expect(verdict).toEqual({ ok: true, problems: [] });
  });

  it('fails when one runtime records a different output, naming case, runtime and both values', () => {
    const verdict = compareReports([
      report(NODE, agreed),
      report(IOS, [passing('money', 'sum=5'), passing('random', 'draw=18')]),
    ]);

    expect(verdict.ok).toBe(false);
    expect(verdict.problems).toEqual([
      'random: output 1 differs on hermes/ios: expected "draw=17" (node/node) but got "draw=18"',
    ]);
  });

  it('fails when a runtime records fewer outputs', () => {
    const verdict = compareReports([report(NODE, agreed), report(IOS, [passing('money', 'sum=5'), passing('random')])]);

    expect(verdict.problems).toEqual(['random: hermes/ios recorded 0 outputs, node/node recorded 1']);
  });

  it('fails when any case fails, even if every runtime fails it the same way', () => {
    const failed: CaseResult = { name: 'money', status: 'fail', error: 'expected 5 but got 6', outputs: [] };
    const verdict = compareReports([report(NODE, [failed]), report(IOS, [failed])]);

    expect(verdict.problems).toEqual([
      'money: failed on node/node: expected 5 but got 6',
      'money: failed on hermes/ios: expected 5 but got 6',
    ]);
  });

  it('fails when the runtimes did not run the same cases', () => {
    const verdict = compareReports([report(NODE, agreed), report(ANDROID, [passing('money', 'sum=5')])]);

    expect(verdict.problems).toEqual(['random: missing on hermes/android']);
  });

  it('fails when a required launch leg is missing or the app did not run on Hermes', () => {
    const notHermes: Runtime = { jsEngine: 'other', platform: 'android', version: 'JSC' };
    const verdict = compareReports([report(NODE, agreed), report(notHermes, agreed)], { requiredLegs: LAUNCH_LEGS });

    expect(verdict.problems).toEqual([
      'missing report from hermes/ios',
      'missing report from hermes/android',
      'other/android is not a launch runtime',
    ]);
  });

  it('fails on a non-Hermes device report even when the Hermes report is also present', () => {
    const notHermes: Runtime = { jsEngine: 'other', platform: 'ios', version: 'JSC' };
    const verdict = compareReports([report(NODE, agreed), report(IOS, agreed), report(notHermes, agreed)], {
      requiredLegs: LAUNCH_LEGS.slice(0, 2),
    });

    expect(verdict.problems).toEqual(['other/ios is not a launch runtime']);
  });

  it('fails when there is nothing to compare', () => {
    expect(compareReports([report(NODE, [])]).problems).toEqual(['node/node ran no cases']);
  });

  it('fails when reports come from different suites', () => {
    const other: Report = { ...report(IOS, agreed), suite: 'definitions' };

    expect(compareReports([report(NODE, agreed), other]).problems).toEqual([
      'hermes/ios ran suite "definitions", expected "engine"',
    ]);
  });
});
