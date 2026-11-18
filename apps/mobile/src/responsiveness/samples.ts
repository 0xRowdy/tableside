// Spec 1 Launch gates 5; #121; docs/development.md Responsiveness sampling

import type { GameId } from '@tableside/engine';

export type Measure = 'acknowledgment' | 'completion' | 'cold-launch';

export const TARGET_MS: Readonly<Record<Measure, number>> = { acknowledgment: 100, completion: 250, 'cold-launch': 5000 };
export const MIN_SAMPLES: Readonly<Record<Measure, number>> = { acknowledgment: 100, completion: 100, 'cold-launch': 30 };
const MEASURES = Object.keys(TARGET_MS) as readonly Measure[];
const ACTION_MEASURES: readonly Measure[] = ['acknowledgment', 'completion'];

export const COLD_LAUNCH = 'cold-launch';

// Spec 3 Launch gates 8: challenges are sampled beside the games; #156
export const CHALLENGE = 'challenge';
export type SampledArea = GameId | typeof CHALLENGE;

// Spec 1 Launch gates 5; Spec 3 Launch gates 8; docs/development.md Responsiveness sampling (action families)
export const GATE_FAMILIES: Readonly<Record<SampledArea, readonly string[]>> = {
  blackjack: ['place-wager', 'remove-wager', 'begin-turn', 'play:hit', 'play:stand', 'play:double', 'play:split', 'play:surrender', 'play:decline-insurance', 'insurance', 'rebuy'],
  craps: ['place-wager', 'remove-wager', 'set-working', 'begin-turn', 'rebuy'],
  roulette: ['place-wager', 'remove-wager', 'begin-turn', 'rebuy'],
  challenge: ['answer-submission', 'card-advance', 'checkpoint-entry'],
};
const GAMES = Object.keys(GATE_FAMILIES) as readonly SampledArea[];

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
  readonly game: SampledArea | null;
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
  readonly game: SampledArea | null;
  readonly family: string;
  readonly count: number;
  readonly p95: number | null;
  readonly max: number | null;
  readonly target: number;
  readonly result: 'pass' | 'fail';
  readonly tooFew: boolean;
}

const deviceKey = (device: DeviceInfo) => [device.model, device.os, device.osVersion, device.abi, device.build].join('\u0000');
const deviceTitle = (device: DeviceInfo) => `${device.model} · ${device.os} ${device.osVersion} · ${device.abi} · build ${device.build}`;
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function responsivenessReport(samples: readonly ResponsivenessSample[]): { readonly rows: readonly ReportRow[]; readonly text: string } {
  type Family = Pick<ResponsivenessSample, 'device' | 'measure' | 'game' | 'family'>;
  const groups = new Map<string, { readonly family: Family; readonly values: number[] }>();
  const add = (family: Family, value: number | null) => {
    const key = [deviceKey(family.device), family.measure, family.game ?? '', family.family].join('\u0001');
    const group = groups.get(key) ?? { family, values: [] };
    if (value !== null) group.values.push(value);
    groups.set(key, group);
  };
  for (const sample of samples) {
    add(sample, null);
    for (const game of GAMES) {
      for (const family of GATE_FAMILIES[game]) for (const measure of ACTION_MEASURES) add({ device: sample.device, measure, game, family }, null);
    }
    add({ device: sample.device, measure: 'cold-launch', game: null, family: COLD_LAUNCH }, null);
  }
  for (const sample of samples) add(sample, sample.ms);
  const rows = [...groups.values()]
    .map(({ family, values }): ReportRow => {
      const p95 = nearestRankP95(values);
      const target = TARGET_MS[family.measure];
      return {
        ...family,
        count: values.length,
        p95,
        max: values.length === 0 ? null : Math.max(...values),
        target,
        result: p95 !== null && p95 <= target ? 'pass' : 'fail',
        tooFew: values.length < MIN_SAMPLES[family.measure],
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

const formatMs = (ms: number | null) => (ms === null ? '—' : String(Math.round(ms * 10) / 10));

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
    (sample.game === null || GAMES.includes(sample.game as SampledArea)) &&
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
