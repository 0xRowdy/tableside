import type { Report, Runtime } from './portable';

export type Leg = Pick<Runtime, 'jsEngine' | 'platform'>;

/** The three runtimes the engine ships on: the Node runner and the app's bundled Hermes. */
export const LAUNCH_LEGS: readonly Leg[] = [
  { jsEngine: 'node', platform: 'node' },
  { jsEngine: 'hermes', platform: 'ios' },
  { jsEngine: 'hermes', platform: 'android' },
];

export interface Verdict {
  ok: boolean;
  problems: string[];
}

const legName = (leg: Leg) => `${leg.jsEngine}/${leg.platform}`;

/**
 * Compares reports of the same suite from different runtimes. The first report
 * is the reference. Any failed case, missing case or differing output fails.
 */
export function compareReports(reports: readonly Report[], options: { requiredLegs?: readonly Leg[] } = {}): Verdict {
  const problems: string[] = [];

  for (const leg of options.requiredLegs ?? []) {
    const present = reports.some((r) => r.runtime.jsEngine === leg.jsEngine && r.runtime.platform === leg.platform);
    if (!present) problems.push(`missing report from ${legName(leg)}`);
  }
  for (const r of reports) {
    const isLaunchLeg = LAUNCH_LEGS.some((leg) => leg.jsEngine === r.runtime.jsEngine && leg.platform === r.runtime.platform);
    if (!isLaunchLeg) problems.push(`${legName(r.runtime)} is not a launch runtime`);
  }

  const [reference, ...others] = reports;
  if (!reference) return { ok: false, problems: [...problems, 'no reports to compare'] };
  const referenceName = legName(reference.runtime);

  for (const r of reports) {
    if (r.cases.length === 0) problems.push(`${legName(r.runtime)} ran no cases`);
    if (r.suite !== reference.suite) problems.push(`${legName(r.runtime)} ran suite "${r.suite}", expected "${reference.suite}"`);
  }

  const caseNames = [...new Set(reports.flatMap((r) => r.cases.map((c) => c.name)))];
  for (const name of caseNames) {
    for (const r of reports) {
      const result = r.cases.find((c) => c.name === name);
      if (!result) problems.push(`${name}: missing on ${legName(r.runtime)}`);
      else if (result.status === 'fail') problems.push(`${name}: failed on ${legName(r.runtime)}: ${result.error ?? 'no detail'}`);
    }

    const expected = reference.cases.find((c) => c.name === name)?.outputs;
    if (!expected) continue;
    for (const r of others) {
      const actual = r.cases.find((c) => c.name === name)?.outputs;
      if (!actual) continue;
      const runtime = legName(r.runtime);
      if (actual.length !== expected.length) {
        problems.push(`${name}: ${runtime} recorded ${actual.length} outputs, ${referenceName} recorded ${expected.length}`);
        continue;
      }
      const index = actual.findIndex((output, i) => output !== expected[i]);
      if (index >= 0) {
        problems.push(
          `${name}: output ${index + 1} differs on ${runtime}: expected ${JSON.stringify(expected[index])} (${referenceName}) but got ${JSON.stringify(actual[index])}`,
        );
      }
    }
  }

  return { ok: problems.length === 0, problems };
}
