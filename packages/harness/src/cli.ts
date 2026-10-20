// Cross-runtime harness command line. See docs/cross-runtime-harness.md.
//
//   harness [all]                 Node, iOS and Android legs, then compare
//   harness node [--grep text]    run the suite on Node only
//   harness ios | android         run the suite in the app on a simulator / emulator
//   harness compare <reports...>  compare saved reports
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';

import { compareReports, LAUNCH_LEGS, type Leg } from './compare';
import { runDeviceLeg } from './devices';
import { runSuite, type Report, type Suite } from './portable';
import { REPO_ROOT } from './paths';

const DEFAULT_SUITE = path.join(REPO_ROOT, 'packages/engine/test/suite.ts');
const DEFAULT_OUT = path.join(REPO_ROOT, 'harness-reports');

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    suite: { type: 'string', default: DEFAULT_SUITE },
    out: { type: 'string', default: DEFAULT_OUT },
    grep: { type: 'string' },
  },
});
const [command = 'all', ...rest] = positionals;

// pnpm runs scripts from the package directory; resolve user paths from where the command was run.
const fromInvocation = (file: string) => path.resolve(process.env.INIT_CWD ?? process.cwd(), file);

async function loadSuite(): Promise<Suite> {
  const module = (await import(pathToFileURL(fromInvocation(values.suite)).href)) as Record<string, unknown>;
  const suite = Object.values(module).find(
    (value): value is Suite => typeof value === 'object' && value !== null && 'cases' in value && 'name' in value,
  );
  if (!suite) throw new Error(`${values.suite} exports no suite`);
  const grep = values.grep;
  return grep ? { ...suite, cases: suite.cases.filter((c) => c.name.includes(grep)) } : suite;
}

async function save(report: Report): Promise<string> {
  const out = fromInvocation(values.out);
  await mkdir(out, { recursive: true });
  const file = path.join(out, `${report.runtime.platform}.json`);
  await writeFile(file, `${JSON.stringify(report, null, 2)}\n`);
  return file;
}

function summarize(report: Report): void {
  const failed = report.cases.filter((c) => c.status === 'fail');
  console.log(`${report.runtime.jsEngine}/${report.runtime.platform} (${report.runtime.version}): ${report.cases.length - failed.length}/${report.cases.length} cases passed`);
  for (const c of failed) console.log(`  ✗ ${c.name}: ${c.error ?? ''}`);
}

function judge(reports: Report[], requiredLegs: readonly Leg[] = []): boolean {
  const verdict = compareReports(reports, { requiredLegs });
  if (verdict.ok) {
    console.log(`✓ ${reports.length} runtime(s) agree on all ${reports[0]?.cases.length ?? 0} cases`);
  } else {
    console.log(`✗ ${verdict.problems.length} problem(s):`);
    for (const problem of verdict.problems) console.log(`  - ${problem}`);
  }
  return verdict.ok;
}

async function nodeLeg(): Promise<Report> {
  const report = runSuite(await loadSuite(), { jsEngine: 'node', platform: 'node', version: process.version });
  summarize(report);
  console.log(`  report: ${path.relative(REPO_ROOT, await save(report))}`);
  return report;
}

async function deviceLeg(platform: 'ios' | 'android'): Promise<Report> {
  const report = await runDeviceLeg(platform);
  summarize(report);
  console.log(`  report: ${path.relative(REPO_ROOT, await save(report))}`);
  return report;
}

async function main(): Promise<boolean> {
  switch (command) {
    case 'node':
      return judge([await nodeLeg()]);
    case 'ios':
    case 'android':
      return judge([await nodeLeg(), await deviceLeg(command)], LAUNCH_LEGS.filter((leg) => leg.platform === 'node' || leg.platform === command));
    case 'compare': {
      const reports = await Promise.all(rest.map(async (file) => JSON.parse(await readFile(fromInvocation(file), 'utf8')) as Report));
      return judge(reports);
    }
    case 'all':
      return judge([await nodeLeg(), await deviceLeg('ios'), await deviceLeg('android')], LAUNCH_LEGS);
    default:
      throw new Error(`unknown command "${command}"`);
  }
}

main().then(
  (ok) => process.exit(ok ? 0 : 1),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
