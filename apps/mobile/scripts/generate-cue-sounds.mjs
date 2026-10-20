// Synthesizes the sixteen launch sound cues (#49, #66) as original works: sine
// tones and seeded noise only, no samples or third-party material. The output
// is deterministic, so re-running it reproduces the committed files byte for
// byte; provenance.json records each file's SHA-256.
//
//   node apps/mobile/scripts/generate-cue-sounds.mjs

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RATE = 22_050;
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'sounds');

// xorshift32: a seeded noise source, so the files never change between runs.
function noise(seed) {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return x / 0x8000_0000 - 1;
  };
}

/** A buffer of `seconds` of silence to mix voices into. */
const silence = (seconds) => new Float64Array(Math.round(seconds * RATE));

/** A tone gliding from `from` to `to` Hz with a fast attack and exponential decay. */
function tone(buffer, { at = 0, length, from, to = from, gain = 0.5, decay = 6 }) {
  const start = Math.round(at * RATE);
  const count = Math.round(length * RATE);
  let phase = 0;
  for (let i = 0; i < count && start + i < buffer.length; i++) {
    const t = i / count;
    phase += (2 * Math.PI * (from + (to - from) * t)) / RATE;
    const attack = Math.min(1, i / (0.004 * RATE));
    buffer[start + i] += gain * attack * Math.exp(-decay * t) * Math.sin(phase);
  }
}

/** A noise burst, low-passed by a one-pole filter (`smooth` near 1 is darker). */
function burst(buffer, { at = 0, length, gain = 0.4, smooth = 0.6, decay = 10, seed = 1 }) {
  const start = Math.round(at * RATE);
  const count = Math.round(length * RATE);
  const next = noise(seed);
  let y = 0;
  for (let i = 0; i < count && start + i < buffer.length; i++) {
    y = smooth * y + (1 - smooth) * next();
    buffer[start + i] += gain * Math.exp((-decay * i) / count) * y;
  }
}

const CUES = {
  '01-card-dealt': () => {
    const b = silence(0.12);
    burst(b, { length: 0.1, gain: 0.7, smooth: 0.3, decay: 8, seed: 11 });
    return b;
  },
  '02-stake-set': () => {
    const b = silence(0.18);
    tone(b, { length: 0.06, from: 2400, gain: 0.35, decay: 9 });
    burst(b, { length: 0.05, gain: 0.3, smooth: 0.2, seed: 21 });
    tone(b, { at: 0.07, length: 0.08, from: 2900, gain: 0.3, decay: 9 });
    return b;
  },
  '03-wager-removed': () => {
    const b = silence(0.2);
    tone(b, { length: 0.08, from: 2600, gain: 0.3, decay: 9 });
    tone(b, { at: 0.08, length: 0.1, from: 1900, gain: 0.3, decay: 9 });
    burst(b, { at: 0.08, length: 0.05, gain: 0.2, smooth: 0.2, seed: 31 });
    return b;
  },
  '04-dice-thrown': () => {
    const b = silence(0.6);
    [0, 0.09, 0.2, 0.29, 0.42].forEach((at, i) => burst(b, { at, length: 0.08, gain: 0.55 - i * 0.06, smooth: 0.45, seed: 41 + i }));
    return b;
  },
  '05-ball-landed': () => {
    // The wheel: ticks that slow down, then the ball drops into a pocket.
    const b = silence(1.8);
    let at = 0;
    for (let i = 0; at < 1.45; i++) {
      tone(b, { at, length: 0.025, from: 3200, gain: 0.25, decay: 12 });
      at += 0.04 + i * 0.006;
    }
    burst(b, { at: 1.5, length: 0.12, gain: 0.6, smooth: 0.4, seed: 51 });
    tone(b, { at: 1.5, length: 0.2, from: 1100, gain: 0.3, decay: 10 });
    return b;
  },
  '06-net-win': () => {
    const b = silence(0.42);
    tone(b, { length: 0.18, from: 523.25, gain: 0.4, decay: 4 });
    tone(b, { at: 0.12, length: 0.3, from: 783.99, gain: 0.4, decay: 4 });
    return b;
  },
  '07-net-loss': () => {
    const b = silence(0.42);
    tone(b, { length: 0.18, from: 392, gain: 0.4, decay: 4 });
    tone(b, { at: 0.12, length: 0.3, from: 261.63, gain: 0.4, decay: 4 });
    return b;
  },
  '08-net-even': () => {
    const b = silence(0.3);
    tone(b, { length: 0.28, from: 440, gain: 0.4, decay: 5 });
    return b;
  },
  '09-input-rejected': () => {
    const b = silence(0.3);
    tone(b, { length: 0.11, from: 185, gain: 0.5, decay: 3 });
    tone(b, { at: 0.14, length: 0.13, from: 175, gain: 0.5, decay: 3 });
    return b;
  },
  '10-answer-accepted': () => {
    const b = silence(0.1);
    tone(b, { length: 0.08, from: 1500, to: 1300, gain: 0.35, decay: 8 });
    return b;
  },
  '11-checkpoint-due': () => {
    const b = silence(0.3);
    tone(b, { length: 0.28, from: 659.25, gain: 0.4, decay: 5 });
    return b;
  },
  '12-attempt-ended': () => {
    const b = silence(0.7);
    [392, 523.25, 659.25].forEach((from, i) => tone(b, { at: i * 0.16, length: 0.3, from, gain: 0.35, decay: 4 }));
    return b;
  },
  '13-correct': () => {
    const b = silence(0.3);
    tone(b, { length: 0.12, from: 880, gain: 0.35, decay: 5 });
    tone(b, { at: 0.08, length: 0.2, from: 1318.5, gain: 0.35, decay: 5 });
    return b;
  },
  '14-incorrect': () => {
    const b = silence(0.35);
    tone(b, { length: 0.32, from: 311.13, to: 246.94, gain: 0.45, decay: 4 });
    return b;
  },
  '15-correction-offered': () => {
    const b = silence(0.42);
    tone(b, { length: 0.18, from: 587.33, gain: 0.4, decay: 4 });
    tone(b, { at: 0.15, length: 0.25, from: 493.88, gain: 0.4, decay: 4 });
    return b;
  },
  '16-milestone': () => {
    const b = silence(0.9);
    [523.25, 659.25, 783.99, 1046.5].forEach((from, i) => tone(b, { at: i * 0.14, length: 0.35, from, gain: 0.3, decay: 4 }));
    return b;
  },
};

/** 16-bit mono PCM WAV. */
function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32_767), i * 2));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

for (const [name, make] of Object.entries(CUES)) {
  writeFileSync(join(OUT, `${name}.wav`), wav(make()));
}
