import { fileURLToPath } from 'node:url';

import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const eslint = new ESLint({ cwd: fileURLToPath(new URL('..', import.meta.url)) });

async function problems(code: string, file = 'packages/engine/src/example.ts'): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: file });
  return (result?.messages ?? []).map((m) => m.ruleId ?? m.message);
}

describe('reference comments rule', () => {
  it.each([
    ['// Spec 2 Deletion, Amendment 9 §3'],
    ['// spec 7 D9'],
    ['// ADR 0001'],
    ['// #104'],
    ['// docs/development.md Releases'],
    ['// TODO(#123)'],
    ['// TODO(spec 7 D9)'],
    ['// shortcut: #123'],
    ['/* Spec 2 Deletion */'],
    ['// @ts-expect-error'],
    ['// eslint-disable-next-line no-console -- #104'],
    [['// @vitest', 'environment node'].join('-')],
    ['/// <reference types="node" />'],
  ])('accepts %s', async (comment) => {
    expect(await problems(`${comment}\nexport const x = 1;\n`)).not.toContain('comments/reference-only');
  });

  it.each([
    ['// Clamp first, the server rounds down.', 'an explanation'],
    ['// TODO: tidy this up', 'a TODO without a reference'],
    ['// #000000B3 over the felt reads at 4.5:1', 'a hex colour, which is not an issue number'],
    ['// TODO(frames): unverified against S2-22', 'a TODO citing no spec or issue'],
    ['// shortcut: linear scan, fine below 1k rows', 'a shortcut without an issue'],
    ['/**\n * Spec 2 Deletion\n */', 'a multi-line block'],
    [`// Spec 2 Deletion ${'and the reasons why '.repeat(5)}`, 'a reference that runs on into prose'],
  ])('rejects %s (%s)', async (comment) => {
    expect(await problems(`${comment}\nexport const x = 1;\n`)).toContain('comments/reference-only');
  });

  it('applies in the app', async () => {
    expect(await problems('// Explains the workaround.\nexport const x = 1;\n', 'apps/web/src/example.ts')).toContain(
      'comments/reference-only',
    );
  });
});
