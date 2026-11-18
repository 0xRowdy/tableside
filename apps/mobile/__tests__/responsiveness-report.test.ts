// Spec 1 Launch gates 5; #121
import {
  GATE_FAMILIES,
  MIN_SAMPLES,
  nearestRankP95,
  parseExport,
  responsivenessReport,
  TARGET_MS,
  type DeviceInfo,
  type ReportRow,
  type ResponsivenessSample,
} from '@/responsiveness/samples';

const PHONE: DeviceInfo = { model: 'iPhone 8', os: 'iOS', osVersion: '16.7', build: '0.1.0 (12)', abi: 'arm64' };
const TABLET: DeviceInfo = { ...PHONE, model: 'iPad (7th generation)' };

const sample = (ms: number, overrides: Partial<ResponsivenessSample> = {}): ResponsivenessSample => ({
  version: 1,
  device: PHONE,
  measure: 'acknowledgment',
  game: 'roulette',
  family: 'place-wager',
  start: 1000,
  end: 1000 + ms,
  ms,
  ...overrides,
});

const times = (count: number, ms: number) => Array.from({ length: count }, () => ms);
const sampled = (rows: readonly ReportRow[]) => rows.filter((row) => row.count > 0);

describe('nearest-rank p95', () => {
  it('of 20 samples is the 19th smallest (rank ⌈19⌉)', () => {
    const values = Array.from({ length: 20 }, (_, i) => (i + 1) * 10);
    expect(nearestRankP95([...values].reverse())).toBe(190);
  });

  it('of 10 samples is the largest (rank ⌈9.5⌉ = 10), so an outlier there is the p95', () => {
    expect(nearestRankP95([...times(9, 40), 5000])).toBe(5000);
  });

  it('of 100 samples is rank 95, with an outlier at rank 100 kept rather than trimmed', () => {
    expect(nearestRankP95([...times(99, 40), 5000])).toBe(40);
  });

  it('of 21 samples is rank ⌈19.95⌉ = 20, inside four tied values at ranks 18–21', () => {
    expect(nearestRankP95([...Array.from({ length: 17 }, (_, i) => i + 1), 90, 90, 90, 90])).toBe(90);
  });

  it('of 40 samples is rank 38, the second of three tied values', () => {
    expect(nearestRankP95([...times(37, 10), 70, 70, 70])).toBe(70);
  });

  it('is undefined with no samples', () => {
    expect(nearestRankP95([])).toBeNull();
  });
});

describe('the report', () => {
  it('passes a family whose p95 is within its target and fails one beyond it', () => {
    const report = responsivenessReport([
      ...times(100, 100).map((ms) => sample(ms)),
      ...times(94, 200).map((ms) => sample(ms, { measure: 'completion' })),
      ...times(6, 251).map((ms) => sample(ms, { measure: 'completion' })),
    ]);
    expect(sampled(report.rows)).toEqual([
      expect.objectContaining({ measure: 'acknowledgment', family: 'place-wager', count: 100, p95: 100, max: 100, target: 100, result: 'pass', tooFew: false }),
      expect.objectContaining({ measure: 'completion', family: 'place-wager', count: 100, p95: 251, max: 251, target: 250, result: 'fail', tooFew: false }),
    ]);
  });

  it('uses the gate targets for each measure', () => {
    expect(TARGET_MS).toEqual({ acknowledgment: 100, completion: 250, 'cold-launch': 5000 });
    expect(MIN_SAMPLES).toEqual({ acknowledgment: 100, completion: 100, 'cold-launch': 30 });
  });

  it('flags a family under 100 samples and cold launch under 30', () => {
    const report = responsivenessReport([
      ...times(99, 50).map((ms) => sample(ms)),
      ...times(29, 2000).map((ms) => sample(ms, { measure: 'cold-launch', game: null, family: 'cold-launch' })),
      ...times(30, 2000).map((ms) => sample(ms, { device: TABLET, measure: 'cold-launch', game: null, family: 'cold-launch' })),
    ]);
    const flags = sampled(report.rows).map((row) => [row.device.model, row.measure, row.count, row.tooFew, row.result]);
    expect(flags).toEqual([
      ['iPad (7th generation)', 'cold-launch', 30, false, 'pass'],
      ['iPhone 8', 'acknowledgment', 99, true, 'pass'],
      ['iPhone 8', 'cold-launch', 29, true, 'pass'],
    ]);
  });

  it('lists every family of every game for each device, failing and flagging those with no samples', () => {
    const { rows } = responsivenessReport([sample(10)]);
    expect(Object.values(GATE_FAMILIES).flat()).toHaveLength(20);
    expect(rows).toHaveLength(20 * 2 + 1);
    expect(rows).toContainEqual(
      expect.objectContaining({ measure: 'completion', game: 'blackjack', family: 'play:surrender', count: 0, p95: null, max: null, result: 'fail', tooFew: true }),
    );
    expect(rows).toContainEqual(expect.objectContaining({ measure: 'cold-launch', game: null, family: 'cold-launch', count: 0, result: 'fail', tooFew: true }));
  });

  it('separates devices, builds, games and families', () => {
    const report = responsivenessReport([
      sample(10),
      sample(10, { device: { ...PHONE, build: '0.1.0 (13)' } }),
      sample(10, { game: 'craps' }),
      sample(10, { family: 'remove-wager' }),
    ]);
    expect(sampled(report.rows).map((row) => `${row.device.build} ${row.game} ${row.family}`)).toEqual([
      '0.1.0 (12) craps place-wager',
      '0.1.0 (12) roulette place-wager',
      '0.1.0 (12) roulette remove-wager',
      '0.1.0 (13) roulette place-wager',
    ]);
  });

  it('prints one line per device and family with count, p95, max and the result', () => {
    const { text } = responsivenessReport([...times(99, 50).map((ms) => sample(ms)), sample(400)]);
    expect(text).toContain('iPhone 8 · iOS 16.7 · arm64 · build 0.1.0 (12)');
    expect(text).toMatch(/acknowledgment\s+roulette\s+place-wager\s+100\s+50\s+400\s+≤ 100\s+pass\n/);
    expect(text).toMatch(/completion\s+blackjack\s+play:split\s+0\s+—\s+—\s+≤ 250\s+fail\s+too few samples \(0 < 100\)/);
  });

  it('marks a too-few family in the printed result', () => {
    const { text } = responsivenessReport([sample(50)]);
    expect(text).toMatch(/pass\s+too few samples \(1 < 100\)/);
  });
});

describe('reading an export', () => {
  it('reads one sample per line and skips blank lines', () => {
    const lines = `${JSON.stringify(sample(12))}\n\n${JSON.stringify(sample(13))}\n`;
    expect(parseExport(lines).map((s) => s.ms)).toEqual([12, 13]);
  });

  it('refuses a line that is not a version 1 sample', () => {
    expect(() => parseExport(`${JSON.stringify({ ...sample(12), version: 2 })}\n`)).toThrow('line 1');
    expect(() => parseExport(`${JSON.stringify(sample(12))}\n{"measure":"acknowledgment"}\n`)).toThrow('line 2');
    expect(() => parseExport('not json\n')).toThrow('line 1');
  });
});
