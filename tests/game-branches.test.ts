import { fileURLToPath } from 'node:url';

import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const root = new ESLint({ cwd: fileURLToPath(new URL('..', import.meta.url)) });
const app = new ESLint({ cwd: fileURLToPath(new URL('../apps/mobile', import.meta.url)) });

async function rules(code: string, file: string): Promise<(string | null)[]> {
  const eslint = file.startsWith('apps/mobile/') ? app : root;
  const [result] = await eslint.lintText(code, { filePath: fileURLToPath(new URL(`../${file}`, import.meta.url)) });
  return (result?.messages ?? []).map((m) => m.ruleId);
}

describe('game branch rule', () => {
  it.each([
    ["export const f = (v: { game: string }) => v.game === 'craps';", 'packages/engine/src/shared.ts'],
    ["export const f = (v: { game: string }) => 'roulette' !== v.game;", 'packages/definitions/src/shared.ts'],
    ["export const f = (g?: { id: string }) => g?.id === 'blackjack';", 'apps/mobile/src/play/Shared.tsx'],
    [
      "export const f = (v: { game: string }) => {\n  switch (v.game) {\n    case 'craps':\n      return 1;\n    default:\n      return 0;\n  }\n};",
      'apps/mobile/src/practice/shared.ts',
    ],
  ])('rejects %s in shared code (%s)', async (code, file) => {
    expect(await rules(code, file)).toContain('games/no-game-branch');
  });

  it.each([
    ["export const f = (v: { game: string }) => v.game === 'craps';", 'packages/engine/src/craps-strategy.ts'],
    ["export const f = (v: { game: string }) => v.game === 'craps';", 'apps/mobile/src/play/CrapsTable.tsx'],
    ["export const f = (r: { peek: string }) => r.peek === 'blackjack';", 'packages/engine/src/shared.ts'],
  ])('accepts %s in %s', async (code, file) => {
    expect(await rules(code, file)).not.toContain('games/no-game-branch');
  });
});

describe('game words rule', () => {
  it.each([
    ['export const t = () => <Text>No wagers yet. Choose one, then spin.</Text>;', 'apps/mobile/src/play/bet-selector/Shared.tsx'],
    ["export const t = 'Last roll settled.';", 'apps/mobile/src/play/shared-text.ts'],
    ['export const t = (n: number) => `Round ${n} is over`;', 'apps/mobile/src/play/shared-text.ts'],
  ])('rejects %s in shared app code', async (code, file) => {
    expect(await rules(code, file)).toContain('games/no-game-words');
  });

  it.each([
    ['export const t = () => <Text>Then spin.</Text>;', 'apps/mobile/src/play/RouletteTable.tsx'],
    ["export const t = 'Same rules, wheel and spins as before.';", 'apps/mobile/src/play/game-words.ts'],
    ["export const cue = 'card-dealt';", 'apps/mobile/src/feedback/shared.ts'],
    ["export type Unit = 'spin' | 'roll' | 'round';", 'apps/mobile/src/play/shared-text.ts'],
  ])('accepts %s in %s', async (code, file) => {
    expect(await rules(code, file)).not.toContain('games/no-game-words');
  });
});
