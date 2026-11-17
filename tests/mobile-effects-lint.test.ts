import { fileURLToPath } from 'node:url';

import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const eslint = new ESLint({ cwd: fileURLToPath(new URL('../apps/mobile', import.meta.url)) });

async function problems(code: string, file = 'src/play/Example.tsx'): Promise<{ rule: string | null; message: string }[]> {
  const [result] = await eslint.lintText(code, { filePath: fileURLToPath(new URL(`../apps/mobile/${file}`, import.meta.url)) });
  return (result?.messages ?? []).map((m) => ({ rule: m.ruleId, message: m.message }));
}

const rules = async (code: string, file?: string) => (await problems(code, file)).map((p) => p.rule);

describe('app effect and timer rules', () => {
  it.each(['useEffect', 'useLayoutEffect', 'useInsertionEffect'])('rejects importing %s from react, naming the hooks to use instead', async (hook) => {
    const found = await problems(`import { ${hook} } from 'react';\nexport const h = ${hook};\n`);
    expect(found).toContainEqual({ rule: 'no-restricted-imports', message: expect.stringContaining('src/hooks') });
  });

  it.each(['useEffect', 'useLayoutEffect', 'useInsertionEffect'])('rejects React.%s', async (hook) => {
    expect(await rules(`import React from 'react';\nexport const h = React.${hook};\n`)).toContain('no-restricted-properties');
  });

  it.each(['setTimeout', 'setInterval', 'requestAnimationFrame', 'requestIdleCallback'])('rejects the %s global, naming a port or usePolling', async (timer) => {
    const found = await problems(`${timer}(() => undefined, 1);\n`, 'src/account/Example.ts');
    expect(found).toContainEqual({ rule: 'no-restricted-globals', message: expect.stringMatching(/usePolling|port/) });
  });

  it('rejects an inline function passed to useFollow', async () => {
    const code = "import { useFollow } from '@/hooks/use-follow';\nexport function C({ s }: { s: { on(): () => void } }) {\n  useFollow((x) => x.on(), s);\n  return null;\n}\n";
    expect(await rules(code)).toContain('no-restricted-syntax');
  });

  it('accepts a named follow function passed to useFollow', async () => {
    const code = "import { useFollow } from '@/hooks/use-follow';\nconst followS = (x: { on(): () => void }) => x.on();\nexport function C({ s }: { s: { on(): () => void } }) {\n  useFollow(followS, s);\n  return null;\n}\n";
    expect(await rules(code)).not.toContain('no-restricted-syntax');
  });

  it('allows the effect-free React hooks', async () => {
    expect(await rules("import { useState, useSyncExternalStore } from 'react';\nexport const h = [useState, useSyncExternalStore];\n")).toEqual([]);
  });

  it('lets src/hooks hold the effects and timers', async () => {
    const code = "import { useEffect } from 'react';\nexport const h = useEffect;\nsetInterval(() => undefined, 1);\n";
    expect(await rules(code, 'src/hooks/use-example.ts')).toEqual([]);
  });

  it.each(['src/practice/app-adapters.ts', 'src/account/device-ports.ts', 'src/account/native-vault.ts'])('lets the platform adapter %s keep its timers, but not effects', async (file) => {
    expect(await rules('setTimeout(() => undefined, 1);\n', file)).toEqual([]);
    expect(await rules("import { useEffect } from 'react';\nexport const h = useEffect;\n", file)).toContain('no-restricted-imports');
  });

  it('keeps the money rule alongside', async () => {
    expect(await rules('export const n = BigInt(1);\n')).toContain('no-restricted-syntax');
  });
});
