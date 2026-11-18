// Spec 3 Challenge content › Table, Reshuffle, Observe seats; Testing Decisions › Seam 1; #137
import type { TestCase } from '@tableside/harness';

import {
  advanceChallenge,
  challengeAttemptRecord,
  challengeResults,
  createChallenge,
  decodeChallengeCheckpoint,
  encodeChallengeCheckpoint,
  readChallengeView,
  type ChallengeCommand,
  type ChallengeFact,
  type ChallengeState,
  type TableStep,
  type TableView,
} from '../src';

import { ANSWER, begun, checkView, learnView, NEXT, REVEAL, seed, SKIP, step } from './challenge.fixtures';
import { expectCheckViewHides, revealingFields } from './information-hiding';
import { OBSERVE, TABLE_CHECK, TABLE_LEARN, tableSpec, TABLE_V1, withExtraPlayers } from './table.fixtures';

const face = (card: { rank: number; suit: string } | null) => (card === null ? 'down' : `${card.rank}${card.suit[0]}`);

function trace(start: ChallengeState, limit = Infinity): string[] {
  const lines: string[] = [];
  let state = start;
  while (state.phase !== 'ended' && lines.length < limit) {
    const view = learnView(state);
    const item = view.item as TableStep;
    if (view.phase === 'question' && item.step === 'prompt') {
      const answered = step(state, ANSWER(0));
      lines.push(`${item.timing} ${item.count} ${learnView(answered).feedback?.reference}`);
      state = step(answered, NEXT);
      continue;
    }
    if (item.step === 'shuffle') lines.push('shuffle');
    if (item.step === 'deal' || item.step === 'reveal') {
      for (const event of item.events) lines.push(event.kind === 'peeked' ? `peeked ${event.result}` : event.kind === 'split' ? `${event.target} split` : `${event.target} ${event.action}`);
      lines.push(item.step === 'reveal' ? `hole ${face(item.face)}` : `${item.to} ${face(item.face)}`);
    }
    state = step(state, NEXT);
  }
  return lines;
}

function runningAtRoundStart(state: ChallengeState): number {
  const steps = state.items as TableStep[];
  const round = stepOf(state).round;
  let running = 0;
  for (const [index, item] of steps.entries()) {
    if (item.round >= round || index >= state.position) break;
    if (item.step === 'shuffle') running = 0;
    if ((item.step === 'deal' || item.step === 'reveal') && item.face) running += item.face.rank >= 2 && item.face.rank <= 6 ? 1 : item.face.rank >= 7 && item.face.rank <= 9 ? 0 : -1;
  }
  return steps.some((item, index) => index < state.position && item.round === round && item.step === 'shuffle') ? 0 : running;
}

const stepOf = (state: ChallengeState) => state.items[state.position] as TableStep;

const valueAt = (root: unknown, path: string): unknown =>
  path
    .replace(/^view/, '')
    .split(/[.[\]]/)
    .filter(Boolean)
    .reduce((value, key) => (value as Record<string, unknown>)[key], root);

const cardsIn = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.flatMap(cardsIn);
  if (value === null || typeof value !== 'object') return [];
  if ('rank' in value && 'suit' in value) return [face(value as { rank: number; suit: string })];
  return Object.values(value).flatMap(cardsIn);
};

function playThrough(start: ChallengeState, answer: (state: ChallengeState) => ChallengeCommand = () => SKIP, visit: (state: ChallengeState) => void = () => undefined): ChallengeState {
  let state = start;
  while (state.phase !== 'ended') {
    visit(state);
    state = step(state, state.phase === 'question' ? answer(state) : NEXT);
  }
  return state;
}

const promptsOf = (state: ChallengeState) => (state.items as TableStep[]).flatMap((item) => (item.step === 'prompt' ? [`${item.round} ${item.timing} ${item.count}`] : []));

const exposedSum = (table: TableView) =>
  [...table.dealer.cards, ...table.seats.flatMap((seat) => seat.hands.flatMap((hand) => hand.cards))].reduce(
    (sum: number, card) => sum + (card === null ? 0 : card.rank >= 2 && card.rank <= 6 ? 1 : card.rank >= 7 && card.rank <= 9 ? 0 : -1),
    0,
  );

function factsOf(state: ChallengeState, command: ChallengeCommand): readonly ChallengeFact[] {
  const result = advanceChallenge(state, { sequence: state.sequence, commandId: `f-${state.sequence}`, command });
  if (result.status !== 'committed') throw new Error(JSON.stringify(result));
  return result.facts;
}

function findState(spec: ReturnType<typeof tableSpec>, wanted: (state: ChallengeState) => boolean): ChallengeState {
  for (let n = 1; n < 200; n++) {
    let found: ChallengeState | null = null;
    playThrough(begun(spec, seed(n)), () => SKIP, (state) => {
      if (!found && wanted(state)) found = state;
    });
    if (found) return found;
  }
  throw new Error('no seed reaches that state');
}

export const tableCases: TestCase[] = [
  {
    name: 'table N=1: running and true count before each bet, cards one at a time in dealing order, running count after the final dealer card',
    run: (t) => {
      // Spec 3 Testing Decisions › Seam 1; docs/cross-runtime-harness.md
      t.equal(trace(begun(TABLE_LEARN, seed(1)), 23), [
        'before-bet running 0',
        'before-bet true 0',
        'hand-1 13d',
        'dealer 3h',
        'hand-1 4c',
        'dealer down',
        'hand-1 stand',
        'hole 3d',
        'dealer 3c',
        'dealer 4c',
        'dealer 12c',
        'after-round running 3',
        'before-bet running 3',
        'before-bet true 0',
        'hand-1 11d',
        'dealer 13c',
        'hand-1 7s',
        'dealer down',
        'peeked no-blackjack',
        'hand-1 stand',
        'hole 11d',
        'after-round running 0',
        'before-bet running 0',
      ]);
      t.equal(readChallengeView(begun(TABLE_LEARN, seed(1))).phase, 'question');
    },
  },
  {
    name: 'table N>1: running and true count only after rounds N, 2N, … and the final partial block; no other prompts',
    run: (t) => {
      const schedule = (interval: number) => promptsOf(playThrough(begun(tableSpec('check', { interval }), seed(3))));
      const block = (...rounds: number[]) => rounds.flatMap((round) => [`${round} block running`, `${round} block true`]);
      t.equal(schedule(2), block(2, 4, 6, 8, 10));
      t.equal(schedule(3), block(3, 6, 9, 10));
      t.equal(schedule(7), block(7, 10));
      t.equal(schedule(10), block(10));
      const everyRound = promptsOf(playThrough(begun(TABLE_CHECK, seed(3))));
      t.equal(everyRound.slice(0, 3), ['1 before-bet running', '1 before-bet true', '1 after-round running']);
      t.equal([everyRound.length, everyRound.at(-1)], [30, '10 after-round running']);
      const results = challengeResults(playThrough(begun(tableSpec('check', { interval: 3 }), seed(3))));
      t.equal([results?.ending, results?.metrics['running-count'], results?.metrics['true-count'], results?.metrics['card-values']], ['completed', { correct: 0, total: 4 }, { correct: 0, total: 4 }, null]);
      t.equal(
        results?.review.map((fact) => (fact.kind === 'table' ? [fact.checkpoint, fact.round, fact.count, fact.entered, fact.error] : null)),
        [1, 1, 2, 2, 3, 3, 4, 4].map((checkpoint, index) => [checkpoint, [3, 3, 6, 6, 9, 9, 10, 10][index], index % 2 === 0 ? 'running' : 'true', 'skip', null]),
      );
    },
  },
  {
    name: 'table: a checkpoint is a phase; nothing but an answer, skip, reveal or end is legal until it is answered',
    run: (t) => {
      const state = begun(TABLE_CHECK, seed(1));
      const view = checkView(state);
      t.equal([view.phase, view.legalCommands, view.table?.prompt, view.countRange], [
        'question',
        ['answer', 'skip', 'reveal-count', 'end'],
        { checkpoint: 1, timing: 'before-bet', count: 'running' },
        { min: -120, max: 120 },
      ]);
      const refused = advanceChallenge(state, { sequence: state.sequence, commandId: 'x', command: NEXT });
      t.equal(refused.status === 'rejected' && refused.reason, 'not-legal-in-phase');
      const tooBig = advanceChallenge(state, { sequence: state.sequence, commandId: 'y', command: ANSWER(121) });
      t.equal(tooBig.status === 'rejected' && [tooBig.reason, tooBig.message], ['malformed', 'a running count is a whole number from −120 to +120']);
      const trueCount = step(step(state, ANSWER(0)), NEXT);
      t.equal([checkView(trueCount).table?.prompt?.count, checkView(trueCount).countRange], ['true', { min: -240, max: 240 }]);
    },
  },
  {
    name: 'table: cue 11 is due when a checkpoint prompt appears, cue 1 for each card, and nothing extra for its true-count half',
    run: (t) => {
      const start = createChallenge(TABLE_CHECK, seed(1));
      t.equal(factsOf(start, { kind: 'begin' }), [{ kind: 'checkpoint-due', position: 0 }]);
      const state = begun(TABLE_CHECK, seed(1));
      const recorded = step(state, ANSWER(0));
      t.equal(factsOf(recorded, NEXT), []);
      const atTrue = step(recorded, NEXT);
      t.equal(factsOf(step(atTrue, ANSWER(0)), NEXT), [{ kind: 'content-shown', position: 2 }]);
      const blocks = begun(tableSpec('check', { interval: 3 }), seed(1));
      t.equal(factsOf(createChallenge(tableSpec('check', { interval: 3 }), seed(1)), { kind: 'begin' }), [{ kind: 'content-shown', position: 0 }]);
      t.equal(stepOf(blocks).step, 'deal');
    },
  },
  {
    name: 'table: only exposed cards count; the face-down hole card adds nothing until it is revealed',
    run: (t) => {
      let state = step(begun(tableSpec('check', { interval: 3 }), seed(1)), REVEAL);
      state = step(step(step(state, NEXT), NEXT), NEXT);
      const down = checkView(state);
      t.equal([stepOf(state).step, down.table?.dealer.cards, down.countAid], ['deal', [{ rank: 3, suit: 'hearts' }, null], { revealed: true, count: 1 }]);
      const up = checkView(step(state, NEXT));
      t.equal([up.table?.dealer.cards, up.countAid?.count], [[{ rank: 3, suit: 'hearts' }, { rank: 3, suit: 'diamonds' }], 2]);
      t.equal(JSON.stringify(down.table).includes('{"rank":3,"suit":"diamonds"}'), false);
    },
  },
  {
    name: 'table: a negative peek reveals no rank; the hole card stays out of the count and the view while players act',
    run: (t) => {
      const peeked = findState(tableSpec('check', { interval: 10 }), (state) => {
        const item = stepOf(state);
        return item.step === 'deal' && item.to !== 'dealer' && item.events.some((event) => event.kind === 'peeked' && event.result === 'no-blackjack');
      });
      const view = checkView(step(peeked, REVEAL));
      t.equal([view.table?.dealer.peek, view.table?.dealer.cards.length, view.table?.dealer.cards[1], view.table?.settled], ['no-blackjack', 2, null, false]);
      t.equal(view.countAid?.count, runningAtRoundStart(peeked) + exposedSum(view.table as TableView));
    },
  },
  {
    name: 'table: split hands stay in their originating round, each with its own cards, and the round checkpoint counts them all',
    run: (t) => {
      const atPrompt = findState(TABLE_LEARN, (state) => {
        const item = stepOf(state);
        if (item.step !== 'prompt' || item.timing !== 'after-round') return false;
        return (state.items as TableStep[]).some((other) => other.round === item.round && (other.step === 'deal' || other.step === 'reveal') && other.events.some((event) => event.kind === 'split'));
      });
      const view = learnView(atPrompt);
      const table = view.table as TableView;
      const split = table.seats.find((seat) => seat.hands.length > 1);
      t.equal([split !== undefined, split?.hands.every((hand) => hand.cards.length >= 2), table.settled, table.seats.every((seat) => seat.hands.every((hand) => hand.result !== null))], [true, true, true, true]);
      const before = runningAtRoundStart(atPrompt);
      const answered = learnView(step(atPrompt, ANSWER(0)));
      t.equal(answered.feedback?.reference, before + exposedSum(table));
      const steps = atPrompt.items as TableStep[];
      const roundOf = (index: number) => (steps[index] as TableStep).round;
      t.equal(steps.slice(0, atPrompt.position).filter((item, index) => item.step !== 'prompt' && item.step !== 'shuffle' && roundOf(index) > table.round).length, 0);
    },
  },
  {
    name: 'table reshuffle: four extra players at 50% penetration; the round finishes, the shoe is shuffled, the count resets and the divisor follows the new shoe',
    run: (t) => {
      const spec = tableSpec('learn', withExtraPlayers(4, 50));
      const reshuffling = findState(spec, (candidate) => stepOf(candidate).step === 'shuffle');
      const random = reshuffling.identities.random;
      let state = begun(spec, { protocol: random.protocol, key: [...random.key], session: [...random.session] });
      const seen: string[] = [];
      let shuffledAt: ChallengeState | null = null;
      let prior = state;
      while (state.phase !== 'ended' && shuffledAt === null) {
        const item = stepOf(state);
        if (item.step === 'shuffle') shuffledAt = state;
        else {
          if (item.step === 'prompt') seen.push(`${item.round} ${item.timing} ${item.count}`);
          state = step(state, state.phase === 'question' ? SKIP : NEXT);
          prior = state;
          if (state.phase === 'explanation') state = step(state, NEXT);
        }
      }
      if (shuffledAt === null) throw new Error('the seed never reshuffles');
      const view = learnView(shuffledAt);
      const round = view.table?.round as number;
      t.equal(seen.at(-1), `${round - 1} after-round running`);
      t.equal([view.phase, view.legalCommands, view.table?.step, view.table?.decks, view.table?.dealer.cards, view.table?.seats.flatMap((seat) => seat.hands.flatMap((hand) => hand.cards))], [
        'card',
        ['next-item', 'reveal-count', 'end'],
        'shuffle',
        6,
        [],
        [],
      ]);
      t.equal(view.table?.seats.length, 5);
      t.equal(factsOf(prior, NEXT), [{ kind: 'shoe-shuffled', position: shuffledAt.position }]);
      const before = step(shuffledAt, NEXT);
      const running = learnView(step(before, ANSWER(0)));
      t.equal([stepOf(before), running.feedback?.reference, running.feedback?.explanation], [
        { step: 'prompt', round, checkpoint: 2 * round - 1, timing: 'before-bet', count: 'running' },
        0,
        { kind: 'table-running', round, cards: [], values: [], before: 0, shuffled: true, count: 0 },
      ]);
      const trueCount = learnView(step(step(step(before, ANSWER(0)), NEXT), ANSWER(0)));
      t.equal([trueCount.feedback?.reference, trueCount.table?.decks], [0, 6]);
      t.equal(shuffledAt.items.filter((item) => 'step' in item && item.step === 'shuffle').length, 1);
      t.equal(playThrough(shuffledAt).table?.round, 10);
    },
  },
  {
    name: 'table Learn: a running-count prompt explains the exposed cards since the last running count; a true count explains its conversion',
    run: (t) => {
      const state = begun(TABLE_LEARN, seed(1));
      const firstRound = (state.items as TableStep[]).filter((item) => item.round === 1);
      const afterRound = firstRound.findIndex((item) => item.step === 'prompt' && item.timing === 'after-round');
      let at = state;
      while (at.position < afterRound) {
        at = step(at, at.phase === 'question' ? ANSWER(0) : NEXT);
        if (at.phase === 'explanation') at = step(at, NEXT);
      }
      const wrong = learnView(step(at, ANSWER(4)));
      t.equal([wrong.feedback?.correct, wrong.feedback?.reference, wrong.feedback?.scored, wrong.legalCommands], [false, 3, true, ['retry-item', 'next-item', 'reveal-count', 'end']]);
      t.equal(wrong.feedback?.explanation, {
        kind: 'table-running',
        round: 1,
        cards: [
          { rank: 13, suit: 'diamonds' },
          { rank: 3, suit: 'hearts' },
          { rank: 4, suit: 'clubs' },
          { rank: 3, suit: 'diamonds' },
          { rank: 3, suit: 'clubs' },
          { rank: 4, suit: 'clubs' },
          { rank: 12, suit: 'clubs' },
        ],
        values: [-1, 1, 1, 1, 1, 1, -1],
        before: 0,
        shuffled: false,
        count: 3,
      });
      const retried = learnView(step(step(step(at, ANSWER(4)), { kind: 'retry-item' }), ANSWER(3)));
      t.equal([retried.feedback?.correct, retried.feedback?.scored], [true, false]);
      let nextRound = step(step(step(step(at, ANSWER(3)), NEXT), ANSWER(3)), NEXT);
      nextRound = step(nextRound, ANSWER(1));
      t.equal(learnView(nextRound).feedback?.explanation, { kind: 'conversion', running: 3, decks: 6, trueCount: 0, exact: false });
      t.equal(learnView(nextRound).feedback?.reference, 0);
    },
  },
  {
    // Spec 3 Amendment 1 C5; #53
    name: 'table Learn N>1: a block checkpoint\'s feedback names only cards still on display, and counts the earlier rounds as a number',
    run: (t) => {
      let blocks = 0;
      playThrough(begun(tableSpec('learn', { ...withExtraPlayers(2), interval: 3 }), seed(3)), () => ANSWER(0), (state) => {
        const item = stepOf(state);
        if (state.phase !== 'question' || item.step !== 'prompt' || item.count !== 'running') return;
        blocks++;
        const table = learnView(state).table as TableView;
        const shown = [...table.dealer.cards, ...table.seats.flatMap((seat) => seat.hands.flatMap((hand) => hand.cards))].flatMap((card) => (card ? [face(card)] : []));
        const answered = learnView(step(state, ANSWER(0)));
        const named = revealingFields(answered).flatMap((path) => cardsIn(valueAt(answered, path)));
        t.equal([item.round, named.filter((card) => !shown.includes(card))], [item.round, []]);
        t.equal([item.round, [...named].sort()], [item.round, [...shown].sort()]);
        const explanation = answered.feedback?.explanation as Extract<NonNullable<typeof answered.feedback>['explanation'], { kind: 'table-running' }>;
        t.equal([item.round, explanation.before], [item.round, runningAtRoundStart(state)]);
      });
      t.equal(blocks, 4);
    },
  },
  {
    name: 'table Observe: the simulated seat is shown as the learner\'s seat, with the round, the supplied divisor and the next checkpoint round',
    run: (t) => {
      const view = checkView(step(begun(tableSpec('check', { ...withExtraPlayers(2), interval: 3 }), seed(1)), NEXT));
      t.equal([view.length, view.table?.round, view.table?.rounds, view.table?.interval, view.table?.nextCheckpointRound, view.table?.seat, view.table?.decks], [10, 1, 10, 3, 3, 'observe', 6]);
      t.equal(view.table?.rules, { dealer: 'S17', lateSurrender: true, penetration: 75, extraPlayers: 2, minimum: '10' });
      t.equal(view.table?.seats.map((seat) => [seat.seat, seat.learner]), [[1, false], [2, false], [3, true]]);
      t.equal(view.table?.seats.map((seat) => seat.hands.map((hand) => hand.target)), [['seat-1-hand-1'], ['seat-2-hand-1'], ['hand-1']]);
    },
  },
  {
    name: 'table Check: no view in any phase carries correctness, a reference, an explanation or a future card',
    run: (t) => {
      for (const spec of [TABLE_CHECK, tableSpec('check', { ...withExtraPlayers(4, 50), interval: 3 })]) {
        const ended = playThrough(begun(spec, seed(2)), (state) => ANSWER(stepOf(state).round), (state) => {
          const view = checkView(state);
          expectCheckViewHides(t, `${state.phase} ${state.position}`, view);
          const shown = (state.items as TableStep[]).slice(0, state.position + 1).filter((item) => item.round === view.table?.round && item.step === 'deal').length;
          const table = view.table as TableView;
          t.equal([state.position, table.dealer.cards.length + table.seats.reduce((sum, seat) => sum + seat.hands.reduce((n, hand) => n + hand.cards.length, 0), 0)], [state.position, shown]);
          t.equal(JSON.stringify(view).includes('"order"'), false);
        });
        expectCheckViewHides(t, 'ended', checkView(ended));
      }
    },
  },
  {
    name: 'table: invalid setups are refused at creation',
    run: (t) => {
      const refusal = (run: () => unknown) => {
        try {
          run();
        } catch (error) {
          return error instanceof Error ? error.message : 'non-error';
        }
        return 'no error';
      };
      const create = (setup: unknown, content: unknown = TABLE_V1) => refusal(() => createChallenge({ ...TABLE_CHECK, content, table: setup } as never, seed(1)));
      t.equal(create({ ...OBSERVE, interval: 0 }), 'the checkpoint interval is 1 to 10 rounds');
      t.equal(create({ ...OBSERVE, interval: 11 }), 'the checkpoint interval is 1 to 10 rounds');
      t.equal(create({ ...OBSERVE, seat: 'play' }), 'unsupported seat play');
      t.equal(create({ ...OBSERVE, rules: { ...OBSERVE.rules, penetration: 85 } }), 'the table needs spec 1 blackjack rules');
      t.equal(create({ ...OBSERVE, strategy: null }), "the simulated seat needs a basic strategy for the table's rules");
      t.equal(create(OBSERVE, { ...TABLE_V1, rounds: 0 }), 'a table challenge has 1 to 20 rounds');
      const withoutSetup = { attemptId: TABLE_CHECK.attemptId, owner: TABLE_CHECK.owner, device: TABLE_CHECK.device, variant: TABLE_CHECK.variant, content: TABLE_CHECK.content };
      t.equal(refusal(() => createChallenge(withoutSetup, seed(1))), 'the specification has an attempt id, owner, device, variant and content and a table setup');
    },
  },
  {
    name: 'table: resume regenerates nothing; a checkpoint decodes to the same state mid-round and across a reshuffle',
    run: (t) => {
      let state = begun(tableSpec('check', withExtraPlayers(4, 50)), seed(1));
      for (let n = 0; n < 160 && state.phase !== 'ended'; n++) {
        state = step(state, state.phase === 'question' ? ANSWER(1) : NEXT);
        if (n % 40 === 0 || stepOf(state)?.step === 'shuffle') {
          const decoded = decodeChallengeCheckpoint(encodeChallengeCheckpoint(state));
          t.equal(decoded.ok && encodeChallengeCheckpoint(decoded.state) === encodeChallengeCheckpoint(state), true);
        }
      }
      t.equal(encodeChallengeCheckpoint(playThrough(begun(TABLE_CHECK, seed(5)))), encodeChallengeCheckpoint(playThrough(begun(TABLE_CHECK, seed(5)))));
    },
  },
  {
    name: 'table record: the group key carries the rule preset, penetration, extra players, Observe and N; length is the round count',
    run: (t) => {
      const ended = playThrough(begun(tableSpec('check', { ...withExtraPlayers(3, 60), interval: 4 }), seed(1)));
      const record = challengeAttemptRecord(ended, { installation: 'i', startedAt: 1, endedAt: 2, interrupted: false, performanceMs: null, meteringBasis: 'challenge-attempt', allowancePolicyVersion: null, pacing: 'self-paced' });
      t.equal([record.groupKey.category, record.groupKey.length, record.groupKey.reference, record.identities.reference], ['table', 10, TABLE_V1.reference, TABLE_V1.reference]);
      t.equal(record.groupKey.table, {
        rules: { id: 'blackjack-six-deck', version: 1 },
        dealer: 'S17',
        lateSurrender: true,
        penetration: 60,
        extraPlayers: 3,
        seat: 'observe',
        countingMode: null,
        betSchedule: false,
        baseWager: null,
        startingBalance: null,
        checkpointInterval: 4,
      });
      t.equal(record.finances, null);
    },
  },
];
