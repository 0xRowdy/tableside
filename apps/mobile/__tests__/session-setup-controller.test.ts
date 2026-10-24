// Seam 2: what session setup asks of the practice controller, with substitute
// adapters. Edited limits are pinned by the activity as chosen (spec #51 Game
// rules: limits editable before a session); the supervisor port tells setup
// the funding source and allowance line (Amendment 4 §B, §D).

import { blackjackRules } from '@tableside/definitions';

import { alwaysAllowed, type AccessSupervisor } from '@/practice/adapters';
import { PracticeController } from '@/practice/controller';
import { FakeClock, substituteAdapters } from '@/practice/testing/substitutes';

function setup(access: AccessSupervisor = alwaysAllowed) {
  const adapters = { ...substituteAdapters({ clock: new FakeClock(undefined, true) }), access };
  return { controller: new PracticeController(adapters), store: adapters.store };
}

async function pinnedLimits(context: ReturnType<typeof setup>) {
  const snapshot = context.controller.snapshot();
  if (snapshot.status !== 'active') throw new Error(`expected an active session, got ${snapshot.status}`);
  return (await context.store.load(snapshot.view.activityId))?.specification.rules.limits;
}

describe('starting with edited limits', () => {
  it('pins roulette inside and outside limits as chosen', async () => {
    const context = setup();
    await context.controller.load();
    const limits = { inside: { min: '5', max: '50' }, outside: { min: '25', max: '2500' } };
    await context.controller.start({ game: 'roulette', buyIn: '1000', wheel: 'double-zero', limits });
    expect(await pinnedLimits(context)).toEqual(limits);
  });

  it('pins craps flat and proposition limits as chosen', async () => {
    const context = setup();
    await context.controller.load();
    const limits = { flat: { min: '25', max: '5000' }, props: { min: '5', max: '25' } };
    await context.controller.start({ game: 'craps', buyIn: '1000', odds: '2x', limits });
    expect(await pinnedLimits(context)).toEqual(limits);
  });

  it('pins blackjack initial-wager limits from the chosen rules', async () => {
    const context = setup();
    await context.controller.load();
    await context.controller.start({ game: 'blackjack', buyIn: '1000', rules: blackjackRules('S17_LS', 75, 0, { initial: { min: '25', max: '500' } }) });
    expect(await pinnedLimits(context)).toEqual({ initial: { min: '25', max: '500' } });
  });

  it('starts at the launch limits when none are given', async () => {
    const context = setup();
    await context.controller.load();
    await context.controller.start({ game: 'roulette', buyIn: '1000' });
    expect(await pinnedLimits(context)).toEqual({ inside: { min: '1', max: '100' }, outside: { min: '10', max: '1000' } });
  });
});

describe('setup terms', () => {
  it("spec 1's stub offers practice funding with no allowance line", async () => {
    const { controller } = setup();
    expect(await controller.setupTerms('craps')).toEqual({ funding: { source: 'practice-funding' }, allowance: null, seePremium: false });
  });

  it("passes on the supervisor's training bankroll and allowance line for the game asked about", async () => {
    const asked: string[] = [];
    const terms = {
      funding: { source: 'training-bankroll', available: '500' },
      allowance: { title: 'TRAINING BANKROLL', text: '500 training units available. Resets daily; no top-ups.' },
      seePremium: true,
    } as const;
    const { controller } = setup({
      ...alwaysAllowed,
      setupTerms: async ({ game }) => {
        asked.push(game);
        return terms;
      },
    });
    expect(await controller.setupTerms('roulette')).toEqual(terms);
    expect(asked).toEqual(['roulette']);
  });

  it('falls back to practice funding when the supervisor fails to answer; admission still decides at the start', async () => {
    const { controller } = setup({ ...alwaysAllowed, setupTerms: async () => Promise.reject(new Error('offline')) });
    expect(await controller.setupTerms('blackjack')).toEqual({ funding: { source: 'practice-funding' }, allowance: null, seePremium: false });
  });
});
