// Seam 2: strategy settlement through the practice controller. When a craps
// strategy's cycle ends, or the strategy stops, with a contract on the table,
// the controller rolls on by itself, one committed step per roll, until the
// contract settles (spec #51 user stories 51 and 52); like final settlement,
// those rolls are never asked about, charged or timed. Pass with odds on the
// "pi digits" stream: 8 sets the point, then 11, 6, 4 and 12 leave the pass
// line and the next 8 pays it.

import { PASS_WITH_ODDS } from '@tableside/definitions';
import type { CrapsPermittedView, DomainFact } from '@tableside/engine';

import { alwaysAllowed, type PhaseReport } from '@/practice/adapters';
import { ENDING_STEP_MS, PracticeController, REVEAL_MS, type PracticeSnapshot } from '@/practice/controller';
import type { TransitionCommit } from '@/practice/store';
import { FakeClock, substituteAdapters } from '@/practice/testing/substitutes';

function view(snapshot: PracticeSnapshot): CrapsPermittedView {
  if (snapshot.status !== 'active' || snapshot.view.game !== 'craps') throw new Error(`expected an active craps session, got ${snapshot.status}`);
  return snapshot.view;
}

async function waitFor(condition: () => boolean): Promise<void> {
  for (let i = 0; i < 100 && !condition(); i++) await new Promise((resolve) => setImmediate(resolve));
  if (!condition()) throw new Error('condition never held');
}

function setup(autoClock: boolean) {
  const asked: number[] = [];
  const reports: PhaseReport[] = [];
  const base = substituteAdapters({ clock: new FakeClock(undefined, autoClock) });
  const adapters = {
    ...base,
    access: {
      ...alwaysAllowed,
      beforeTurn: (context: Parameters<typeof alwaysAllowed.beforeTurn>[0]) => {
        asked.push(context.turn);
        return alwaysAllowed.beforeTurn(context);
      },
      phaseChanged: (report: PhaseReport) => reports.push(report),
    },
  };
  const commits: { kind: string; facts: readonly DomainFact[] }[] = [];
  const commit = adapters.store.commitTransition.bind(adapters.store);
  adapters.store.commitTransition = async (transition: TransitionCommit) => {
    const outcome = await commit(transition);
    if (outcome.status === 'committed') commits.push({ kind: (JSON.parse(transition.receipt.command) as { kind: string }).kind, facts: transition.facts });
    return outcome;
  };
  const controller = new PracticeController(adapters);
  return { adapters, controller, clock: adapters.clock, asked, reports, commits };
}

const settledPass = (commits: { facts: readonly DomainFact[] }[]) =>
  commits.flatMap((commit) => commit.facts).filter((fact) => fact.kind === 'wager-settled' && fact.target === 'pass');

describe('strategy settlement', () => {
  it('after an override ends the cycle, rolls on by itself until the pass line settles, unasked, uncharged and untimed, then shows the cycle result', async () => {
    const { controller, asked, reports, commits } = setup(true);
    await controller.load();
    await controller.start({ game: 'craps', odds: '3-4-5x', buyIn: '1000', strategy: { definition: PASS_WITH_ODDS, parameters: {} } });
    await controller.placeWager('pass', '10');
    await controller.beginTurn(); // 8: the point
    await controller.placeWager('pass-odds', '30'); // the strategy says 10
    await controller.beginTurn();
    await controller.overrideCorrection(); // 11: the cycle ends, the 30 odds come back

    const after = view(controller.snapshot());
    expect(after).toMatchObject({ phase: 'cycle-completion', balance: '1010', wagers: [], turn: 6, strategy: { cycleEnd: 'override', overrideAffected: true } });
    expect(commits.map((commit) => commit.kind).slice(-5)).toEqual([
      'settle-turn',
      'advance-strategy-settlement', 'advance-strategy-settlement', 'advance-strategy-settlement', 'advance-strategy-settlement',
    ]);
    expect(settledPass(commits)).toMatchObject([{ turn: 6, result: 'win', net: '10' }]);
    // Only the two rolls the player began were put to the supervisor (and could be charged).
    expect(asked).toEqual([1, 2]);
    expect(reports.filter((report) => report.phase === 'strategy-settlement').every((report) => !report.timed)).toBe(true);
    expect(reports.some((report) => report.phase === 'strategy-settlement')).toBe(true);
  });

  it('stops rolling while suspended and carries on from the same roll when resumed', async () => {
    const { controller, clock } = setup(false);
    await controller.load();
    await controller.start({ game: 'craps', odds: '3-4-5x', buyIn: '1000', strategy: { definition: PASS_WITH_ODDS, parameters: {} } });
    await controller.placeWager('pass', '10');
    const rolling = controller.beginTurn();
    await waitFor(() => clock.pending === 1);
    clock.advance(REVEAL_MS);
    await rolling;

    const stopping = controller.stopStrategy();
    await waitFor(() => clock.pending === 1 && view(controller.snapshot()).phase === 'strategy-settlement');
    controller.suspend('navigation');
    clock.advance(ENDING_STEP_MS);
    await stopping;
    expect(view(controller.snapshot())).toMatchObject({ phase: 'strategy-settlement', turn: 1, wagers: [{ target: 'pass', amount: '10' }] });

    const resuming = controller.resume();
    for (let roll = 0; roll < 5; roll++) {
      await waitFor(() => clock.pending === 1);
      clock.advance(ENDING_STEP_MS);
    }
    await resuming;
    expect(view(controller.snapshot())).toMatchObject({ phase: 'settled-outcome', turn: 6, balance: '1010', wagers: [], strategy: { status: 'stopped' } });
  });

  it('ending the practice session while suspended in it hands the contract to final settlement', async () => {
    const { controller, clock, commits } = setup(false);
    await controller.load();
    await controller.start({ game: 'craps', odds: '3-4-5x', buyIn: '1000', strategy: { definition: PASS_WITH_ODDS, parameters: {} } });
    await controller.placeWager('pass', '10');
    const rolling = controller.beginTurn();
    await waitFor(() => clock.pending === 1);
    clock.advance(REVEAL_MS);
    await rolling;
    const stopping = controller.stopStrategy();
    await waitFor(() => clock.pending === 1 && view(controller.snapshot()).phase === 'strategy-settlement');
    controller.suspend('navigation');
    clock.advance(ENDING_STEP_MS);
    await stopping;

    const ending = controller.endSession();
    for (let i = 0; i < 6 && controller.snapshot().status === 'active'; i++) {
      await waitFor(() => clock.pending === 1 || controller.snapshot().status !== 'active');
      clock.advance(ENDING_STEP_MS);
    }
    await ending;
    expect(commits.map((commit) => commit.kind).slice(3)).toEqual([
      'stop-strategy', 'request-stop',
      'advance-final-settlement', 'advance-final-settlement', 'advance-final-settlement', 'advance-final-settlement', 'advance-final-settlement',
    ]);
    expect(controller.snapshot()).toMatchObject({ status: 'completed', result: { finalCashOut: '1010', endingReason: 'stop' } });
  });
});
