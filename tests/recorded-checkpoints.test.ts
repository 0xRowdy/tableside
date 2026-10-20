import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { ENGINE_VERSION, STATE_SCHEMA_VERSION } from '../packages/engine/src';

// Unfinished activities are never aged out (#80). Every released build's
// recorded checkpoints stay exactly as that build wrote them (their SHA-256 is
// in released.json, added when the build ships), and the engine suite keeps
// resuming every one. The build under development keeps its own recording,
// re-recorded while its behaviour still changes.
const RECORDED = new URL('../packages/engine/test/recorded/', import.meta.url);
const CURRENT = `engine-${ENGINE_VERSION}-schema-${STATE_SCHEMA_VERSION}.ts`;

const released = async () => JSON.parse(await readFile(new URL('released.json', RECORDED), 'utf8')) as Record<string, string>;
const recordings = async () => (await readdir(RECORDED)).filter((file) => file.endsWith('.ts') && file !== 'index.ts').sort();

describe('recorded checkpoints', () => {
  it('of released builds are kept byte for byte: none edited or removed', async () => {
    for (const [file, hash] of Object.entries(await released())) {
      const text = await readFile(new URL(file, RECORDED));
      expect([file, createHash('sha256').update(text).digest('hex')]).toEqual([file, hash]);
    }
  });

  it('include this build, so a schema or engine change needs a recording (pnpm --filter @tableside/engine record-checkpoints)', async () => {
    expect(await recordings()).toContain(CURRENT);
  });

  it("are a released build's or this build's: an unreleased build's recording is replaced, not kept", async () => {
    const frozen = await released();
    expect((await recordings()).filter((file) => file !== CURRENT && !(file in frozen))).toEqual([]);
  });

  it('are all run by the engine suite', async () => {
    const index = await readFile(new URL('index.ts', RECORDED), 'utf8');
    for (const file of await recordings()) expect(index).toContain(`from './${file.replace(/\.ts$/, '')}'`);
  });
});
