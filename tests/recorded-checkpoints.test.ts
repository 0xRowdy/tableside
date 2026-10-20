import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

// Unfinished activities are never aged out (#80): each build's recorded
// checkpoints stay exactly as that build wrote them, and the engine suite keeps
// resuming every one. A release adds its recording and its hash here; nothing
// is ever edited or removed, so dropping compatibility code fails this test or
// the engine suite.
const RECORDED = new URL('../packages/engine/test/recorded/', import.meta.url);

/** SHA-256 of every recording, as written when its build was released. */
const FROZEN: Record<string, string> = {
  'engine-0.0.0-schema-3.ts': '4fe6a6cf899a285c26523a61331856ac68adfa11e3c47fb0e27f8e9b72e25368',
};

describe('recorded checkpoints from earlier builds', () => {
  it('are kept byte for byte: none edited or removed', async () => {
    for (const [file, hash] of Object.entries(FROZEN)) {
      const text = await readFile(new URL(file, RECORDED));
      expect([file, createHash('sha256').update(text).digest('hex')]).toEqual([file, hash]);
    }
  });

  it('are all frozen here and all run by the engine suite', async () => {
    const recordings = (await readdir(RECORDED)).filter((file) => file !== 'index.ts').sort();
    expect(recordings).toEqual(Object.keys(FROZEN).sort());
    const index = await readFile(new URL('index.ts', RECORDED), 'utf8');
    for (const file of recordings) expect(index).toContain(`from './${file.replace(/\.ts$/, '')}'`);
  });
});
