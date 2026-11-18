// Spec 1 Launch gates 5; #121; docs/development.md Responsiveness sampling

import type { GameId } from '@tableside/engine';

const GAMES: readonly GameId[] = ['blackjack', 'craps', 'roulette'];

export type Measure = 'acknowledgement' | 'completion' | 'cold-launch';
const MEASURES: readonly Measure[] = ['acknowledgement', 'completion', 'cold-launch'];

export const TARGET_MS: Readonly<Record<Measure, number>> = { acknowledgement: 100, completion: 250, 'cold-launch': 5000 };
export const MIN_SAMPLES: Readonly<Record<Measure, number>> = { acknowledgement: 100, completion: 100, 'cold-launch': 30 };

export const COLD_LAUNCH = 'cold-launch';

export interface DeviceInfo {
  readonly model: string;
  readonly os: string;
  readonly osVersion: string;
  readonly build: string;
  readonly abi: string;
}

export interface ResponsivenessSample {
  readonly version: 1;
  readonly device: DeviceInfo;
  readonly measure: Measure;
  readonly game: GameId | null;
  readonly family: string;
  readonly start: number;
  readonly end: number;
  readonly ms: number;
}

export function nearestRankP95(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(0.95 * sorted.length) - 1] ?? null;
}

export interface ReportRow {
  readonly device: DeviceInfo;
  readonly measure: Measure;
  readonly game: GameId | null;
  readonly family: string;
  readonly count: number;
  readonly p95: number;
  readonly max: number;
  readonly target: number;
  readonly result: 'pass' | 'fail';
  readonly tooFew: boolean;
}

const deviceKey = (device: DeviceInfo) => [device.model, device.os, device.osVersion, device.abi, device.build].join('\u0000');
const deviceTitle = (device: DeviceInfo) => `${device.model} · ${device.os} ${device.osVersion} · ${device.abi} · build ${device.build}`;
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function responsivenessReport(samples: readonly ResponsivenessSample[]): { readonly rows: readonly ReportRow[]; readonly text: string } {
  const groups = new Map<string, ResponsivenessSample[]>();
  for (const sample of samples) {
    const key = [deviceKey(sample.device), sample.measure, sample.game ?? '', sample.family].join('\u0001');
    groups.set(key, [...(groups.get(key) ?? []), sample]);
  }
  const rows = [...groups.values()]
    .map((group): ReportRow => {
      const [first] = group as [ResponsivenessSample];
      const values = group.map((sample) => sample.ms);
      const p95 = nearestRankP95(values) ?? 0;
      const target = TARGET_MS[first.measure];
      return {
        device: first.device,
        measure: first.measure,
        game: first.game,
        family: first.family,
        count: group.length,
        p95,
        max: Math.max(...values),
        target,
        result: p95 <= target ? 'pass' : 'fail',
        tooFew: group.length < MIN_SAMPLES[first.measure],
      };
    })
    .sort(
      (a, b) =>
        compare(deviceKey(a.device), deviceKey(b.device)) ||
        MEASURES.indexOf(a.measure) - MEASURES.indexOf(b.measure) ||
        compare(a.game ?? '', b.game ?? '') ||
        compare(a.family, b.family),
    );
  return { rows, text: reportText(rows) };
}

const HEADINGS = ['measure', 'game', 'family', 'samples', 'p95 ms', 'max ms', 'target', 'result'];

function reportText(rows: readonly ReportRow[]): string {
  const blocks: string[] = [];
  let device: string | null = null;
  let table: string[][] = [];
  const flush = () => {
    if (device === null) return;
    const widths = HEADINGS.map((_, column) => Math.max(...[HEADINGS, ...table].map((cells) => (cells[column] ?? '').length)));
    const line = (cells: readonly string[]) => cells.map((cell, column) => cell.padEnd(widths[column] ?? 0)).join('  ').trimEnd();
    blocks.push([device, line(HEADINGS), ...table.map(line)].join('\n'));
  };
  for (const row of rows) {
    const title = deviceTitle(row.device);
    if (title !== device) {
      flush();
      device = title;
      table = [];
    }
    const result = row.tooFew ? `${row.result}  too few samples (${row.count} < ${MIN_SAMPLES[row.measure]})` : row.result;
    table.push([row.measure, row.game ?? '—', row.family, String(row.count), formatMs(row.p95), formatMs(row.max), `≤ ${row.target}`, result]);
  }
  flush();
  return blocks.length === 0 ? 'No samples.' : blocks.join('\n\n');
}

const formatMs = (ms: number) => String(Math.round(ms * 10) / 10);

const isText = (value: unknown): value is string => typeof value === 'string';
const isTime = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

function isSample(value: unknown): value is ResponsivenessSample {
  if (typeof value !== 'object' || value === null) return false;
  const sample = value as Record<string, unknown>;
  const device = sample.device as Record<string, unknown> | null | undefined;
  return (
    sample.version === 1 &&
    typeof device === 'object' &&
    device !== null &&
    ['model', 'os', 'osVersion', 'build', 'abi'].every((field) => isText(device[field])) &&
    MEASURES.includes(sample.measure as Measure) &&
    (sample.game === null || GAMES.includes(sample.game as GameId)) &&
    isText(sample.family) &&
    isTime(sample.start) &&
    isTime(sample.end) &&
    isTime(sample.ms)
  );
}

export function parseExport(text: string): ResponsivenessSample[] {
  const samples: ResponsivenessSample[] = [];
  text.split('\n').forEach((line, index) => {
    if (line.trim() === '') return;
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      value = undefined;
    }
    if (!isSample(value)) throw new Error(`line ${index + 1} is not a responsiveness sample (version 1)`);
    samples.push(value);
  });
  return samples;
}
