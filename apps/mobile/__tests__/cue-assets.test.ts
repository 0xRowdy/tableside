// The bundled cue sounds: every catalog cue has a file inside the app, each
// file stays within the accepted duration, and each has a provenance record
// that matches it byte for byte.

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CUES } from '@/feedback/catalog';

const SOUNDS = join(__dirname, '..', 'assets', 'sounds');
const provenance = JSON.parse(readFileSync(join(SOUNDS, 'provenance.json'), 'utf8')) as {
  records: { item: string; files: { path: string; sha256: string }[]; origin: string; rightsBasis: string }[];
};

const wavFiles = () => readdirSync(SOUNDS).filter((name) => name.endsWith('.wav')).sort();

/** Seconds of audio in a PCM WAV file, from its header. */
function durationOf(file: Buffer): number {
  expect(file.toString('ascii', 0, 4)).toBe('RIFF');
  expect(file.toString('ascii', 8, 12)).toBe('WAVE');
  const byteRate = file.readUInt32LE(28);
  const dataBytes = file.readUInt32LE(40);
  return dataBytes / byteRate;
}

describe('bundled cue sounds', () => {
  it('has one file per catalog cue, numbered as in the catalog', () => {
    expect(wavFiles().map((name) => Number(name.slice(0, 2)))).toEqual(CUES.map((cue) => cue.number));
    for (const cue of CUES) expect(wavFiles()).toContain(`${String(cue.number).padStart(2, '0')}-${cue.name}.wav`);
  });

  it('keeps every cue under a second, except the wheel, which runs at most two', () => {
    for (const cue of CUES) {
      const seconds = durationOf(readFileSync(join(SOUNDS, `${String(cue.number).padStart(2, '0')}-${cue.name}.wav`)));
      expect(seconds).toBeLessThan(cue.name === 'ball-landed' ? 2 : 1);
    }
  });

  it('has a provenance record for every shipped sound, matching the file', () => {
    const recorded = new Map(provenance.records.flatMap((record) => record.files.map((file) => [file.path, file.sha256] as const)));
    for (const name of wavFiles()) {
      const sha256 = createHash('sha256').update(readFileSync(join(SOUNDS, name))).digest('hex');
      expect(recorded.get(`apps/mobile/assets/sounds/${name}`)).toBe(sha256);
    }
    expect(recorded.size).toBe(wavFiles().length);
  });

  it('records where the paired haptics come from', () => {
    const haptics = provenance.records.find((record) => /haptics/i.test(record.item));
    const paired = CUES.filter((cue) => cue.haptic !== null).map((cue) => cue.number);
    expect(haptics?.item).toContain(`${paired.slice(0, -1).join(', ')} and ${paired.at(-1)}`);
    expect(haptics?.files).toEqual([]);
  });
});
