// Spec 1 Launch gates 5; #121
import { MIN_SAMPLES, nearestRankP95, parseExport, responsivenessReport, TARGET_MS, type DeviceInfo, type ResponsivenessSample } from '@/responsiveness/samples';

const PHONE: DeviceInfo = { model: 'iPhone 8', os: 'iOS', osVersion: '16.7', build: '0.1.0 (12)', abi: 'arm64' };
const TABLET: DeviceInfo = { ...PHONE, model: 'iPad (7th generation)' };

const sample = (ms: number, overrides: Partial<ResponsivenessSample> = {}): ResponsivenessSample => ({
  version: 1,
  device: PHONE,
  measure: 'acknowledgement',
  game: 'roulette',
  family: 'place-wager',
  start: 1000,
  end: 1000 + ms,
  ms,
  ...overrides,
});

const times = (count: number, ms: number) => Array.from({ length: count }, () => ms);

describe('nearest-rank p95', () => {
  it('is the value at rank ceil(0.95 n) of the sorted samples', () => {
    // 20 samples: rank ceil(19) = 19, so the 19th smallest.
    const values = Array.from({ length: 20 }, (_, i) => (i + 1) * 10);
    expect(nearestRankP95([...values].reverse())).toBe(190);
  });

  it('keeps an outlier: it sets the p95 once it falls inside the top 5%', () => {
    // 10 samples: rank ceil(9.5) = 10, the largest, so the outlier is the p95.
    expect(nearestRankP95([...times(9, 40), 5000])).toBe(5000);
    // 100 samples: rank 95; the one outlier sits at rank 100 and is kept, not trimmed.
    expect(nearestRankP95([...times(99, 40), 5000])).toBe(40);
  });

  it('counts tied values at their rank', () => {
    // 21 samples: rank ceil(19.95) = 20; ranks 18–21 are all 90.
    const values = [...Array.from({ length: 17 }, (_, i) => i + 1), 90, 90, 90, 90];
    expect(nearestRankP95(values)).toBe(90);
    // 40 samples: rank 38, which is the second of three tied 70s.
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
    expect(report.rows).toEqual([
      expect.objectContaining({ measure: 'acknowledgement', family: 'place-wager', count: 100, p95: 100, max: 100, target: 100, result: 'pass', tooFew: false }),
      expect.objectContaining({ measure: 'completion', family: 'place-wager', count: 100, p95: 251, max: 251, target: 250, result: 'fail', tooFew: false }),
    ]);
  });

  it('uses the gate targets for each measure', () => {
    expect(TARGET_MS).toEqual({ acknowledgement: 100, completion: 250, 'cold-launch': 5000 });
    expect(MIN_SAMPLES).toEqual({ acknowledgement: 100, completion: 100, 'cold-launch': 30 });
  });

  it('flags a family under 100 samples and cold launch under 30', () => {
    const report = responsivenessReport([
      ...times(99, 50).map((ms) => sample(ms)),
      ...times(29, 2000).map((ms) => sample(ms, { measure: 'cold-launch', game: null, family: 'cold-launch' })),
      ...times(30, 2000).map((ms) => sample(ms, { device: TABLET, measure: 'cold-launch', game: null, family: 'cold-launch' })),
    ]);
    const flags = report.rows.map((row) => [row.device.model, row.measure, row.count, row.tooFew, row.result]);
    expect(flags).toEqual([
      ['iPad (7th generation)', 'cold-launch', 30, false, 'pass'],
      ['iPhone 8', 'acknowledgement', 99, true, 'pass'],
      ['iPhone 8', 'cold-launch', 29, true, 'pass'],
    ]);
  });

  it('separates devices, builds, games and families', () => {
    const report = responsivenessReport([
      sample(10),
      sample(10, { device: { ...PHONE, build: '0.1.0 (13)' } }),
      sample(10, { game: 'craps' }),
      sample(10, { family: 'remove-wager' }),
    ]);
    expect(report.rows.map((row) => `${row.device.build} ${row.game} ${row.family}`)).toEqual([
      '0.1.0 (12) craps place-wager',
      '0.1.0 (12) roulette place-wager',
      '0.1.0 (12) roulette remove-wager',
      '0.1.0 (13) roulette place-wager',
    ]);
  });

  it('prints one line per device and family with count, p95, max and the result', () => {
    const { text } = responsivenessReport([...times(99, 50).map((ms) => sample(ms)), sample(400)]);
    expect(text).toContain('iPhone 8 · iOS 16.7 · arm64 · build 0.1.0 (12)');
    expect(text).toMatch(/acknowledgement\s+roulette\s+place-wager\s+100\s+50\s+400\s+≤ 100\s+pass/);
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
    expect(() => parseExport(`${JSON.stringify(sample(12))}\n{"measure":"acknowledgement"}\n`)).toThrow('line 2');
    expect(() => parseExport('not json\n')).toThrow('line 1');
  });
});
