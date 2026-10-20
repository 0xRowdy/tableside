import { readFile } from 'node:fs/promises';

import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

// The engine and definitions packages run unchanged on Hermes and Node, so the
// lint config forbids anything that ties them to a platform or the outside world.
const eslint = new ESLint({ cwd: new URL('..', import.meta.url).pathname });

async function problems(code: string, file = 'packages/engine/src/example.ts'): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: file });
  return (result?.messages ?? []).map((m) => m.ruleId ?? m.message);
}

describe('engine portability rule', () => {
  it.each([
    ["import React from 'react';", 'react'],
    ["import { Platform } from 'react-native';", 'react-native'],
    ["import * as Haptics from 'expo-haptics';", 'expo'],
    ["import { readFile } from 'node:fs';", 'node builtin'],
    ["import crypto from 'crypto';", 'bare node builtin'],
    ["import { createClient } from '@supabase/supabase-js';", 'network/account SDK'],
    ["export { x } from 'lodash';", 're-export from a package'],
  ])('rejects %s (%s)', async (code) => {
    expect(await problems(code)).toContain('no-restricted-imports');
  });

  it('rejects dynamic imports, which no-restricted-imports does not see', async () => {
    expect(await problems("export const rn = import('react-native');")).toContain('no-restricted-syntax');
  });

  it.each([
    ['export const now = Date.now();', 'clock'],
    ['export const d = new Date();', 'clock'],
    ['export const r = Math.random();', 'unseeded randomness'],
    ["export const p = fetch('https://x');", 'network'],
    ["export const s = localStorage.getItem('k');", 'storage'],
    ['setTimeout(() => {}, 1);', 'timers'],
    ["export const env = process.env['X'];", 'Node process'],
    ['export const t = performance.now();', 'clock'],
    ["export const f = new Intl.NumberFormat('en-US');", 'locale-dependent formatting'],
    ["console.log('hand');", 'logging'],
  ])('rejects %s (%s)', async (code) => {
    expect(await problems(code)).toEqual(
      expect.arrayContaining([expect.stringMatching(/^no-restricted-(globals|properties|syntax)$|^no-console$/)]),
    );
  });

  it('allows relative imports and standard language features', async () => {
    const code = "import { ENGINE_VERSION } from './index';\nexport const v = `${ENGINE_VERSION}:${(2n ** 64n).toString()}`;\n";
    expect(await problems(code)).toEqual([]);
  });

  it('applies to the definitions package, which may import the engine', async () => {
    expect(await problems("import { ENGINE_VERSION } from '@tableside/engine';\nexport const v = ENGINE_VERSION;\n", 'packages/definitions/src/x.ts')).toEqual([]);
    expect(await problems('export const now = Date.now();', 'packages/definitions/src/x.ts')).not.toEqual([]);
  });

  it('does not restrict the app or the Node runner', async () => {
    expect(await problems("import { readFile } from 'node:fs';\nexport { readFile };\n", 'packages/runner/src/x.ts')).toEqual([]);
  });

  it('keeps the engine free of package dependencies', async () => {
    const manifest = JSON.parse(await readFile(new URL('../packages/engine/package.json', import.meta.url), 'utf8')) as Record<string, unknown>;
    expect(manifest['dependencies'] ?? {}).toEqual({});
    expect(manifest['peerDependencies'] ?? {}).toEqual({});
  });
});
