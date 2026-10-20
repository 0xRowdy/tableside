// Seam 2: the access supervisor port, the controller's direct suspend, the
// suspend dispositions and the stop path, with substitute adapters.
// Spin outcomes come from the Random123 "pi digits" stream: 27, 0, 25, 31, 9.

import { CAPPED_MARTINGALE, FLAT_EVEN_MONEY } from '@tableside/definitions';
import type { DomainFact } from '@tableside/engine';

import { alwaysAllowed, withRequiredRemovals, type AccessDecision, type AccessSupervisor, type AdmissionDecision, type PhaseReport, type TurnDecision } from '@/practice/adapters';
import { PracticeController, REVEAL_MS, type PracticeSnapshot } from '@/practice/controller';
import type { ActivityStore, TransitionCommit } from '@/practice/store';
import { FakeClock, substituteAdapters } from '@/practice/testing/substitutes';

type Answer = AccessDecision | Promise<AccessDecision>;

/** A scriptable supervisor: allowed unless a test sets an answer, and it records what it was asked. */
function scriptedAccess() {
  const asked: string[] = [];
  const reports: PhaseReport[] = [];
  const next: { turn?: TurnDecision; resume?: Answer; lifecycle?: Answer; admission?: AdmissionDecision } = {};
  let endBlocked: string | null = null;
  const access: AccessSupervisor = {
    ...alwaysAllowed,
    beforeActivity: async (context) => {
      asked.push(`activity ${context.game}`);
      return (await next.admission) ?? { status: 'allowed', provenance: 'test', meteringBasis: 'turns' };
    },
    beforeTurn: async (context) => {
      asked.push(`turn ${context.turn}`);
      return (await next.turn) ?? { status: 'allowed', provenance: 'test', turnCharge: { grant: 'grant-1', amount: '1' } };
    },
    beforeResume: async (context) => {
      asked.push(`resume ${context.phase}`);
      return (await next.resume) ?? { status: 'allowed', provenance: 'test' };
    },
    onLifecycle: async (context) => {
      asked.push(`lifecycle ${context.event}`);
      return (await next.lifecycle) ?? { status: 'allowed', provenance: 'test' };
    },
    beforeEndWhileSuspended: async () => (endBlocked ? { status: 'blocked', reason: endBlocked } : { status: 'allowed' }),
    phaseChanged: (report) => reports.push(report),
  };
  return { access, asked, reports, next, blockEnd: (reason: string | null) => (endBlocked = reason) };
}

function setup(options: { autoClock?: boolean } = {}) {
  const script = scriptedAccess();
  const adapters = { ...substituteAdapters({ clock: new FakeClock(undefined, options.autoClock ?? true) }), access: script.access };
  const commits = recordCommits(adapters.store);
  const controller = new PracticeController(adapters);
  return { ...script, adapters, store: adapters.store, clock: adapters.clock, controller, commits };
}

async function started(options: { autoClock?: boolean } = {}) {
  const context = setup(options);
  await context.controller.load();
  await context.controller.start({ game: 'roulette', buyIn: '1000' });
  return context;
}

/** Every transition the store was asked to commit: the trace, without wall-clock values. */
function recordCommits(store: ActivityStore) {
  const commits: { command: string; facts: readonly DomainFact[]; checkpoint: string }[] = [];
  const commit = store.commitTransition.bind(store);
  store.commitTransition = async (transition: TransitionCommit) => {
    const outcome = await commit(transition);
    if (outcome.status === 'committed') commits.push({ command: transition.receipt.command, facts: transition.facts, checkpoint: transition.checkpoint });
    return outcome;
  };
  return commits;
}

function active(snapshot: PracticeSnapshot) {
  if (snapshot.status !== 'active') throw new Error(`expected an active session, got ${snapshot.status}`);
  return snapshot;
}

async function waitFor(condition: () => boolean): Promise<void> {
  for (let i = 0; i < 100 && !condition(); i++) await new Promise((resolve) => setImmediate(resolve));
  if (!condition()) throw new Error('condition never held');
}

const kinds = (commits: { command: string }[]) => commits.map((commit) => (JSON.parse(commit.command) as { kind: string }).kind);

const RED_WINS = { kind: 'wager-settled', turn: 1, target: 'red', stake: '10', result: 'win', net: '10', returned: '20' };

describe('admission', () => {
  it('asks before a new activity and records the metering basis the admission carries', async () => {
    const { controller, store, asked } = await started();
    await controller.endSession();

    expect(asked).toEqual(['activity roulette']);
    expect((await store.load('activity-1'))?.admission).toEqual({ provenance: 'test', meteringBasis: 'turns' });
    expect(controller.snapshot()).toMatchObject({ status: 'completed', result: { meteringBasis: 'turns' } });
  });

  it('blocks the start while access is uncertain, creating nothing and drawing no entropy', async () => {
    const { store, next, adapters } = setup();
    let draws = 0;
    const counted = new PracticeController({ ...adapters, entropy: { randomBytes: (n) => (draws++, adapters.entropy.randomBytes(n)) } });
    next.admission = { status: 'uncertain', provenance: 'test', disposition: 'suspend-at-turn-boundary' };
    await counted.load();

    await counted.start({ game: 'roulette', buyIn: '1000' });

    expect(counted.snapshot()).toMatchObject({ status: 'none', problem: 'access-uncertain' });
    expect(await store.findUnfinished()).toBeNull();
    expect(draws).toBe(0);
  });

  it('refuses a denied start with the policy reason and creates nothing', async () => {
    const { controller, store, next } = setup();
    next.admission = { status: 'denied', provenance: 'test', disposition: 'stop', reason: "Today's guided practice is used up." };
    await controller.load();

    await controller.start({ game: 'roulette', buyIn: '1000' });

    expect(controller.snapshot()).toMatchObject({ status: 'none', problem: 'access-denied', problemReason: "Today's guided practice is used up." });
    expect(await store.findUnfinished()).toBeNull();
  });
});

describe('the direct suspend', () => {
  /** Plays: red 10, spin (27 wins), black 10 left removable, spin (0 loses), end. */
  async function play(controller: PracticeController, clock: FakeClock, pauseAt: (step: string) => Promise<void>) {
    await controller.placeWager('red', '10');
    await pauseAt('open decision with a wager');
    const spinning = controller.spin();
    await waitFor(() => clock.pending === 1);
    await pauseAt('revealing');
    clock.advance(REVEAL_MS);
    await spinning;
    await waitFor(() => active(controller.snapshot()).view.phase === 'settled-outcome' && !active(controller.snapshot()).busy);
    await pauseAt('settled outcome');
    await controller.placeWager('black', '10');
    const spinning2 = controller.spin();
    await waitFor(() => clock.pending === 1);
    clock.advance(REVEAL_MS);
    await spinning2;
    await waitFor(() => !active(controller.snapshot()).busy);
    const ending = controller.endSession();
    await waitFor(() => clock.pending === 1);
    await pauseAt('final settlement');
    clock.advance(REVEAL_MS);
    await ending;
    await waitFor(() => controller.snapshot().status === 'completed');
  }

  it('is trace-equivalent to never suspending, in every phase, and draws, settles and charges nothing while suspended', async () => {
    const plain = await started({ autoClock: false });
    await play(plain.controller, plain.clock, async () => undefined);

    const paused = await started({ autoClock: false });
    const pauseAt = async (step: string) => {
      const before = paused.commits.length;
      const phase = active(paused.controller.snapshot()).view.phase;
      paused.controller.suspend('navigation');
      expect(active(paused.controller.snapshot()).suspension).toMatchObject({ cause: 'navigation', kind: 'immediate', reached: true });
      // Time passes while away: nothing reveals, settles or charges.
      paused.clock.advance(REVEAL_MS * 10);
      await new Promise((resolve) => setImmediate(resolve));
      expect({ step, commits: paused.commits.length, phase: active(paused.controller.snapshot()).view.phase }).toEqual({ step, commits: before, phase });
      expect((await paused.store.readEffects('activity-1')).length).toBe(paused.asked.filter((q) => q.startsWith('turn')).length);
      void paused.controller.resume();
      await waitFor(() => active(paused.controller.snapshot()).suspension === null);
    };
    await play(paused.controller, paused.clock, pauseAt);

    expect(paused.commits).toEqual(plain.commits);
    expect(await paused.store.readEffects('activity-1')).toEqual(await plain.store.readEffects('activity-1'));
    expect(paused.controller.snapshot()).toMatchObject({ status: 'completed', result: { finalCashOut: (plain.controller.snapshot() as { result: { finalCashOut: string } }).result.finalCashOut } });
  });

  it('refuses input while suspended, and resumes in the exact committed phase', async () => {
    const { controller, commits } = await started();
    await controller.placeWager('red', '10');
    controller.suspend('navigation');

    await controller.placeWager('black', '10');
    await controller.spin();
    expect(commits).toHaveLength(1);

    await controller.resume();
    expect(active(controller.snapshot())).toMatchObject({ suspension: null, view: { phase: 'open-decision', wagers: [{ target: 'red', amount: '10' }] } });
  });

  it('lets a commit already in flight finish, then starts no automatic step until resumed', async () => {
    const { controller, clock, commits, store } = await started({ autoClock: false });
    await controller.placeWager('red', '10');
    // Hold the spin's commit in the store until the player has left the table.
    let release = () => undefined as void;
    const held = new Promise<void>((resolve) => (release = resolve));
    const commit = store.commitTransition;
    store.commitTransition = async (transition) => {
      await held;
      return commit(transition);
    };
    const spinning = controller.spin();
    await waitFor(() => active(controller.snapshot()).busy);
    await new Promise((resolve) => setImmediate(resolve));
    controller.suspend('app-lifecycle');
    release();
    await spinning;

    expect(kinds(commits)).toEqual(['place-wager', 'begin-turn']);
    expect(active(controller.snapshot()).view.phase).toBe('revealing-outcome');
    expect(clock.pending).toBe(0);

    const resuming = controller.resume();
    await waitFor(() => clock.pending === 1);
    clock.advance(REVEAL_MS);
    await resuming;
    expect(kinds(commits)).toEqual(['place-wager', 'begin-turn', 'settle-turn']);
  });

  it('starts no turn when the player leaves before the spin is sent', async () => {
    const { controller, commits, store } = await started();
    await controller.placeWager('red', '10');
    const spinning = controller.spin();
    controller.suspend('navigation');
    await spinning;

    expect(kinds(commits)).toEqual(['place-wager']);
    expect(await store.readEffects('activity-1')).toEqual([]);
  });

  it('auto-resumes on return only after leaving by navigation or app lifecycle', async () => {
    const { controller, asked } = await started();
    controller.suspend('navigation');
    await controller.resumeOnReturn();
    expect(active(controller.snapshot()).suspension).toBeNull();
    expect(asked).toContain('resume open-decision');

    controller.suspend('sign-out');
    await controller.resumeOnReturn();
    expect(active(controller.snapshot()).suspension).toMatchObject({ cause: 'sign-out' });
  });

  it('suspends on backgrounding and sign-out, and asks the port about each lifecycle event', async () => {
    const { controller, asked } = await started();
    await controller.lifecycle('backgrounded');
    expect(active(controller.snapshot()).suspension).toMatchObject({ cause: 'app-lifecycle' });
    await controller.lifecycle('foregrounded');
    await controller.resumeOnReturn();
    await controller.lifecycle('signed-out');
    expect(active(controller.snapshot()).suspension).toMatchObject({ cause: 'sign-out' });
    expect(asked.filter((q) => q.startsWith('lifecycle'))).toEqual(['lifecycle backgrounded', 'lifecycle foregrounded', 'lifecycle signed-out']);
  });
});

describe('resuming', () => {
  it('after a restart, finds the session suspended and resumes it only when asked', async () => {
    const { controller, adapters, clock } = await started({ autoClock: false });
    await controller.placeWager('red', '10');
    void controller.spin();
    await waitFor(() => clock.pending === 1);

    const relaunched = new PracticeController({ ...adapters, store: adapters.store.reopen(), clock: new FakeClock(undefined, true) });
    await relaunched.load();
    expect(active(relaunched.snapshot())).toMatchObject({ view: { phase: 'revealing-outcome' }, suspension: { cause: 'interrupted', canEnd: false } });

    await relaunched.resume();
    expect(active(relaunched.snapshot())).toMatchObject({ view: { phase: 'settled-outcome', balance: '1010' }, suspension: null });
  });

  it.each([
    ['denied', { status: 'denied', provenance: 'test', disposition: 'suspend', reason: 'Roulette is not your offline game.' }, 'Roulette is not your offline game.'],
    ['uncertain', { status: 'uncertain', provenance: 'test', disposition: 'suspend-at-turn-boundary' }, 'Reconnect to verify access'],
  ] as const)('a %s resume never changes the activity, and End session stays available', async (_, answer, reason) => {
    const { controller, store, next, commits } = await started();
    await controller.placeWager('red', '10');
    controller.suspend('navigation');
    next.resume = answer;

    await controller.resume();

    expect(active(controller.snapshot()).suspension).toMatchObject({ resumeBlocked: reason, canEnd: true });
    expect((await store.load('activity-1'))?.sequence).toBe(1);
    expect(commits).toHaveLength(1);

    await controller.endSession();
    expect(controller.snapshot()).toMatchObject({ status: 'completed', result: { finalCashOut: '1000' } });
  });
});

describe('races with the supervisor', () => {
  it('stays suspended when the player leaves again while a resume is still being asked', async () => {
    const { controller, next, commits, clock } = await started({ autoClock: false });
    await controller.placeWager('red', '10');
    const spinning = controller.spin();
    await waitFor(() => clock.pending === 1);
    controller.suspend('navigation');
    clock.advance(REVEAL_MS);
    await spinning;
    let answer = (_: AccessDecision) => undefined as void;
    next.resume = new Promise<AccessDecision>((resolve) => (answer = resolve));

    const resuming = controller.resumeOnReturn();
    controller.suspend('navigation');
    answer({ status: 'allowed', provenance: 'test' });
    await resuming;

    expect(active(controller.snapshot()).suspension).toMatchObject({ reached: true });
    expect(clock.pending).toBe(0);
    expect(kinds(commits)).toEqual(['place-wager', 'begin-turn']);
  });

  it('keeps an access suspension waiting for its turn boundary when the player leaves, and never lifts it on return', async () => {
    const { controller, next, clock } = await started({ autoClock: false });
    await controller.placeWager('red', '10');
    const spinning = controller.spin();
    await waitFor(() => clock.pending === 1);
    next.lifecycle = { status: 'uncertain', provenance: 'test', disposition: 'suspend-at-turn-boundary', reason: 'Checking your access.' };
    await controller.lifecycle('access-changed');

    controller.suspend('navigation');
    clock.advance(REVEAL_MS);
    await spinning;

    expect(active(controller.snapshot()).suspension).toMatchObject({ cause: 'access', reason: 'Checking your access.', kind: 'immediate' });
    await controller.resumeOnReturn();
    expect(active(controller.snapshot()).suspension).toMatchObject({ cause: 'access' });
  });

  it('treats a supervisor that fails before a turn as uncertain: no turn starts and the session suspends', async () => {
    const { controller, adapters, commits } = await started();
    await controller.placeWager('red', '10');
    adapters.access.beforeTurn = async () => {
      throw new Error('unreachable');
    };

    await controller.spin();

    expect(kinds(commits)).toEqual(['place-wager']);
    expect(active(controller.snapshot()).suspension).toMatchObject({ cause: 'access', reached: true, canEnd: true });
  });

  it('keeps End session available when the gate check fails, explaining it can be tried again', async () => {
    const { controller, adapters, commits } = await started();
    controller.suspend('navigation');
    adapters.access.beforeEndWhileSuspended = async () => {
      throw new Error('unreachable');
    };

    await controller.endSession();

    expect(commits).toHaveLength(0);
    expect(active(controller.snapshot()).suspension).toMatchObject({ canEnd: true, endBlocked: expect.any(String) });
  });

  it('a resume refused because access ended changes nothing, and ending then shows the access-ended stop', async () => {
    const { controller, next, commits } = await started();
    await controller.placeWager('red', '10');
    controller.suspend('navigation');
    next.resume = { status: 'denied', provenance: 'test', disposition: 'stop', reason: 'Training ended for today.' };

    await controller.resume();
    expect(commits).toHaveLength(1);
    expect(active(controller.snapshot())).toMatchObject({ suspension: { resumeBlocked: 'Training ended for today.' }, ending: 'access-ended' });

    await controller.endSession();
    expect(controller.snapshot()).toMatchObject({ status: 'completed', result: { finalCashOut: '1000' } });
  });
});

describe('ending while suspended', () => {
  it('after a turn-boundary suspend, returns removable wagers and settles, offline and without asking for access', async () => {
    const { controller, next, asked, store } = await started();
    await controller.placeWager('red', '10');
    await controller.spin();
    await controller.placeWager('black', '10');
    next.lifecycle = { status: 'uncertain', provenance: 'test', disposition: 'suspend-at-turn-boundary' };
    await controller.lifecycle('access-changed');
    expect(active(controller.snapshot()).suspension).toMatchObject({ kind: 'turn-boundary', reached: true, canEnd: true });
    const askedBefore = asked.length;

    await controller.endSession();

    expect(asked.length).toBe(askedBefore);
    expect(controller.snapshot()).toMatchObject({ status: 'completed', result: { finalCashOut: '1010' } });
    expect((await store.readReceipt('activity-1', 'activity-1/4'))?.facts).toEqual([
      { kind: 'stop-requested', phase: 'open-decision' },
      { kind: 'wager-returned', target: 'black', amount: '10' },
    ]);
  });

  it('is not available mid-round: the session must resume to finish the round first', async () => {
    const { controller, clock, commits } = await started({ autoClock: false });
    await controller.placeWager('red', '10');
    const spinning = controller.spin();
    await waitFor(() => clock.pending === 1);
    controller.suspend('navigation');
    clock.advance(REVEAL_MS);
    await spinning;

    expect(active(controller.snapshot()).suspension).toMatchObject({ canEnd: false });
    await controller.endSession();
    expect(kinds(commits)).toEqual(['place-wager', 'begin-turn']);
    expect(active(controller.snapshot()).view.phase).toBe('revealing-outcome');
  });

  it('is not available while the gate states keep ordinary access closed', async () => {
    const { controller, commits, blockEnd } = await started();
    controller.suspend('sign-out');
    blockEnd('Sign in again to end this session.');

    await controller.endSession();

    expect(commits).toHaveLength(0);
    expect(active(controller.snapshot()).suspension).toMatchObject({ endBlocked: 'Sign in again to end this session.' });
  });
});

describe('dispositions', () => {
  it('a "suspend" before a turn starts no turn and charges nothing; resuming plays the same turn', async () => {
    const { controller, next, commits, store } = await started();
    await controller.placeWager('red', '10');
    next.turn = { status: 'denied', provenance: 'test', disposition: 'suspend' };

    await controller.spin();

    expect(kinds(commits)).toEqual(['place-wager']);
    expect(active(controller.snapshot()).suspension).toMatchObject({ cause: 'access', kind: 'immediate' });
    expect(await store.readEffects('activity-1')).toEqual([]);

    delete next.turn;
    await controller.resume();
    await controller.spin();
    expect(active(controller.snapshot()).view).toMatchObject({ phase: 'settled-outcome', balance: '1010' });
  });

  it('distinguishes "suspend" from "suspend at turn boundary" for the same transition mid-turn', async () => {
    const run = async (disposition: 'suspend' | 'suspend-at-turn-boundary') => {
      const context = await started({ autoClock: false });
      await context.controller.placeWager('red', '10');
      const spinning = context.controller.spin();
      await waitFor(() => context.clock.pending === 1);
      context.next.lifecycle = { status: 'denied', provenance: 'test', disposition };
      await context.controller.lifecycle('access-changed');
      context.clock.advance(REVEAL_MS);
      await spinning;
      return { kinds: kinds(context.commits), snapshot: active(context.controller.snapshot()) };
    };

    const immediate = await run('suspend');
    expect(immediate.kinds).toEqual(['place-wager', 'begin-turn']);
    expect(immediate.snapshot).toMatchObject({ view: { phase: 'revealing-outcome' }, suspension: { kind: 'immediate', canEnd: false } });

    // The turn in progress finishes normally, then the session suspends without settlement.
    const boundary = await run('suspend-at-turn-boundary');
    expect(boundary.kinds).toEqual(['place-wager', 'begin-turn', 'settle-turn']);
    expect(boundary.snapshot).toMatchObject({ view: { phase: 'settled-outcome' }, suspension: { kind: 'turn-boundary', reached: true, canEnd: true } });
  });

  it('"stop" before a turn returns removable wagers and settles automatically, never charging', async () => {
    const { controller, next, store, commits, asked } = await started();
    await controller.placeWager('red', '10');
    next.turn = { status: 'denied', provenance: 'test', disposition: 'stop' };

    await controller.spin();

    expect(kinds(commits)).toEqual(['place-wager', 'request-stop', 'advance-final-settlement']);
    expect(controller.snapshot()).toMatchObject({ status: 'completed', result: { finalCashOut: '1000' } });
    expect(await store.readEffects('activity-1')).toEqual([]);
    expect(asked.filter((q) => q.startsWith('turn'))).toEqual(['turn 1']);
  });

  it('"stop" mid-turn finishes the started turn, stops new play and settles, announcing the access-ended stop', async () => {
    const { controller, next, clock, commits, store } = await started({ autoClock: false });
    await controller.placeWager('red', '10');
    const spinning = controller.spin();
    await waitFor(() => clock.pending === 1);
    next.lifecycle = { status: 'denied', provenance: 'test', disposition: 'stop' };
    await controller.lifecycle('access-changed');
    expect(active(controller.snapshot()).ending).toBe('access-ended');

    clock.advance(REVEAL_MS);
    await waitFor(() => clock.pending === 1 && active(controller.snapshot()).view.phase === 'final-settlement');
    // No new play once the stop path starts.
    expect(active(controller.snapshot()).view.legalCommands).not.toContain('begin-turn');
    clock.advance(REVEAL_MS);
    await spinning;
    await waitFor(() => controller.snapshot().status === 'completed');

    expect(kinds(commits)).toEqual(['place-wager', 'begin-turn', 'settle-turn', 'request-stop', 'advance-final-settlement']);
    expect(commits.flatMap((commit) => commit.facts).filter((fact) => fact.kind === 'wager-settled')).toEqual([RED_WINS]);
    // Only the turn begun before the stop was charged; settlement never is.
    expect((await store.readEffects('activity-1')).map((effect) => effect.effectId.sequence)).toEqual([1]);
  });

  it('"stop" in craps returns removable wagers, then further rolls resolve only the contracts, never asking or charging', async () => {
    // Pi stream rolls: 8 (point), then 11, 6, 4, 12 leave the pass line and 8 pays it.
    const { controller, next, commits, store, asked } = setup();
    await controller.load();
    await controller.start({ game: 'craps', odds: '3-4-5x', buyIn: '1000' });
    await controller.placeWager('pass', '10');
    await controller.beginTurn();
    await controller.placeWager('pass-odds', '50');
    next.turn = { status: 'denied', provenance: 'test', disposition: 'stop' };

    await controller.beginTurn();

    expect(kinds(commits)).toEqual([
      'place-wager', 'begin-turn', 'settle-turn', 'place-wager', 'request-stop',
      'advance-final-settlement', 'advance-final-settlement', 'advance-final-settlement', 'advance-final-settlement', 'advance-final-settlement',
    ]);
    const facts = commits.flatMap((commit) => commit.facts);
    expect(facts.filter((fact) => fact.kind === 'wager-returned')).toEqual([{ kind: 'wager-returned', target: 'pass-odds', amount: '50' }]);
    // No new bets, odds or presses once the stop path starts: only the pass line settles.
    expect(facts.filter((fact) => fact.kind === 'wager-settled').map((fact) => [fact.target, fact.result])).toEqual([['pass', 'win']]);
    expect(controller.snapshot()).toMatchObject({ status: 'completed', result: { game: 'craps', finalCashOut: '1010' } });
    // Only the roll begun before the stop was asked about and charged; the settling rolls never are.
    expect(asked.filter((q) => q.startsWith('turn'))).toEqual(['turn 1', 'turn 2']);
    expect((await store.readEffects('activity-1')).map((effect) => effect.effectId.sequence)).toEqual([1]);
  });

  it('a craps session suspended mid-roll must resume to finish the roll before it can end', async () => {
    const { controller, clock } = setup({ autoClock: false });
    await controller.load();
    await controller.start({ game: 'craps', odds: '3-4-5x', buyIn: '1000' });
    await controller.placeWager('pass', '10');
    const rolling = controller.beginTurn();
    await waitFor(() => clock.pending === 1);
    controller.suspend('sign-out');

    expect(active(controller.snapshot())).toMatchObject({ view: { phase: 'revealing-outcome' }, suspension: { canEnd: false } });
    clock.advance(REVEAL_MS);
    await rolling;
    expect(active(controller.snapshot()).view.phase).toBe('revealing-outcome');
  });

  it('after a restart in the stop path, resumes settlement but never reopens play', async () => {
    const { controller, next, clock, adapters } = await started({ autoClock: false });
    await controller.placeWager('red', '10');
    next.turn = { status: 'denied', provenance: 'test', disposition: 'stop' };
    void controller.spin();
    await waitFor(() => clock.pending === 1 && active(controller.snapshot()).view.phase === 'final-settlement');

    const relaunched = new PracticeController({ ...adapters, store: adapters.store.reopen(), clock: new FakeClock(undefined, true) });
    await relaunched.load();
    expect(active(relaunched.snapshot()).view.legalCommands).toEqual(['advance-final-settlement']);
    await relaunched.resume();

    expect(relaunched.snapshot()).toMatchObject({ status: 'completed', result: { finalCashOut: '1000' } });
  });
});

describe('the timed-metering hook', () => {
  it('reports each change of phase and suspension, timing only open decision, reveal and settled outcome', async () => {
    const { controller, reports } = await started();
    await controller.placeWager('red', '10');
    await controller.spin();
    controller.suspend('navigation');
    await controller.resume();
    await controller.endSession();

    expect(reports.map(({ phase, suspended, timed }) => ({ phase, suspended, timed }))).toEqual([
      { phase: 'open-decision', suspended: false, timed: true },
      { phase: 'revealing-outcome', suspended: false, timed: true },
      { phase: 'settled-outcome', suspended: false, timed: true },
      { phase: 'settled-outcome', suspended: true, timed: false },
      { phase: 'settled-outcome', suspended: false, timed: true },
      { phase: 'final-settlement', suspended: false, timed: false },
      { phase: 'completed', suspended: false, timed: false },
    ]);
  });

  it('excludes a pending strategy action and a cycle result, even in an open decision', async () => {
    // Capped Martingale on black, from 50: 27 and 0 lose 10 and 20, leaving 20 against a stake of 40.
    const { controller, reports } = setup();
    await controller.load();
    await controller.start({ game: 'roulette', buyIn: '50', strategy: { definition: CAPPED_MARTINGALE, parameters: { target: 'black' } } });
    const timedNow = () => reports.at(-1)?.timed;
    for (const stake of ['10', '20']) {
      await controller.placeWager('black', stake);
      await controller.spin();
    }
    expect(active(controller.snapshot()).view.strategy?.pending?.reason).toBe('unfunded-group');
    expect(reports.at(-1)).toMatchObject({ phase: 'settled-outcome', timed: false });
    // A rebuy covers the stake: the pending action clears and time counts again.
    await controller.rebuy('100');
    expect(timedNow()).toBe(true);
    // 25 loses the 40; 31 wins the 80, completing the cycle: its result isn't timed.
    for (const stake of ['40', '80']) {
      await controller.placeWager('black', stake);
      await controller.spin();
    }
    expect(reports.at(-1)).toMatchObject({ phase: 'cycle-completion', timed: false });
  });
});

describe('cycle restarts in practice (Amendment 6 §2)', () => {
  it('a completed cycle waits for the player: practice never restarts it automatically', async () => {
    // Capped Martingale on black from 1,000: 27 loses 10, 0 loses 20, 25 loses 40, 31 wins 80 and completes the cycle.
    const { controller, commits } = setup();
    await controller.load();
    await controller.start({ game: 'roulette', buyIn: '1000', strategy: { definition: CAPPED_MARTINGALE, parameters: { target: 'black' } } });
    for (const stake of ['10', '20', '40', '80']) {
      await controller.placeWager('black', stake);
      await controller.spin();
    }
    for (let i = 0; i < 20; i++) await new Promise((resolve) => setImmediate(resolve));
    const { view } = active(controller.snapshot());
    expect(view.phase).toBe('cycle-completion');
    expect(view.legalCommands).toContain('restart-cycle');
    expect(kinds(commits)).not.toContain('restart-cycle');
  });
});

describe('required content removal (Amendment 6 §5)', () => {
  it('stops a session running a removed strategy revision at the next turn boundary', async () => {
    const removed = new Set<string>();
    const script = scriptedAccess();
    const access = withRequiredRemovals(script.access, { removed: (strategy) => removed.has(`${strategy.id}@${strategy.version}`) });
    const adapters = { ...substituteAdapters({ clock: new FakeClock(undefined, true) }), access };
    const commits = recordCommits(adapters.store);
    const controller = new PracticeController(adapters);
    await controller.load();
    await controller.start({ game: 'roulette', buyIn: '1000', strategy: { definition: FLAT_EVEN_MONEY, parameters: { target: 'red' } } });

    await controller.placeWager('red', '10');
    await controller.spin();
    // The removal arrives (spec 6 syncs it) between turns: the next turn never begins.
    removed.add(`${FLAT_EVEN_MONEY.id}@${FLAT_EVEN_MONEY.revision}`);
    await controller.placeWager('red', '10');
    await controller.spin();

    expect(kinds(commits)).toEqual(['place-wager', 'begin-turn', 'settle-turn', 'place-wager', 'request-stop', 'advance-final-settlement']);
    expect(controller.snapshot()).toMatchObject({ status: 'completed', result: { endingReason: 'access-ended' } });
    // The supervisor behind it is never asked about the turn the removal stopped.
    expect(script.asked.filter((q) => q.startsWith('turn'))).toEqual(['turn 1']);
  });

  it('leaves free play and other strategies alone', async () => {
    const access = withRequiredRemovals(alwaysAllowed, { removed: (strategy) => strategy.id === 'another' });
    expect(await access.beforeTurn({ activityId: 'a', turn: 1, strategy: null })).toMatchObject({ status: 'allowed' });
    expect(await access.beforeTurn({ activityId: 'a', turn: 1, strategy: { id: FLAT_EVEN_MONEY.id, version: 1 } })).toMatchObject({ status: 'allowed' });
    expect(await access.beforeTurn({ activityId: 'a', turn: 1, strategy: { id: 'another', version: 1 } })).toMatchObject({ status: 'denied', disposition: 'stop' });
  });
});
