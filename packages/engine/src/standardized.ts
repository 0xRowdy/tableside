// Standardized sessions (spec 6, Amendment 6): benchmark profiles, their
// monetary-exposure bound, and one session run under the runner policy, where
// the runner is the player and follows the pinned strategy exactly (legal
// fallbacks, the actual reference count, no mistakes or overrides).
//
// A session starts from the profile's funding with a server stream (the
// coordinator's key, session words = the session index) and plays at most the
// profile's opportunities (rounds, rolls or spins; waiting counts). Completed
// cycles restart automatically with the remaining balance, which never happens
// in practice, where restarts stay explicit. New bets stop at the horizon, at
// an explicit stop or a cap, when a required group is unaffordable or past a
// table limit, or when an adjustment leaves the strategy envelope; then the
// stop path returns removable wagers and settles every contract still on the
// table. The session is plain data, so it can be checkpointed between steps.

import {
  advanceActivity,
  createActivity,
  strategyDecision,
  type ActivityState,
  type Command,
  type DomainFact,
  type PendingStrategyAction,
} from './activity';
import { HAND_TARGET, MAX_SPLIT_HANDS, type BlackjackActivityState, type BlackjackRuleSet } from './blackjack';
import { playSituation, policyOf, prescribePlay, moveCommand } from './blackjack-strategy';
import { crapsTurnExposure, type CrapsRuleSet } from './craps';
import { add, compare, decodeMoney, encodeMoney, money, mul, sub, type Money } from './money';
import { serverStreamIdentity } from './random';
import { rouletteLayout, type RouletteRuleSet } from './roulette';
import type { VersionedIdentity } from './shape';
import type { StrategySelection } from './strategy';
import type { Words2 } from './philox';

/** The standardized protocol every benchmark profile shares (spec 6, Benchmark profiles). */
export const BENCHMARK_PROTOCOL = { funding: '1000', base: '10', opportunities: 200, sessions: 100_000 } as const;

interface ProfileBase {
  readonly id: string;
  readonly version: number;
  /** Starting funds, whole units. No rebuys. */
  readonly funding: string;
  /** The strategy base unit; a blackjack strategy without betting instructions bets it every round. */
  readonly base: string;
  /** Table opportunities (rounds, rolls or spins), waiting included. */
  readonly opportunities: number;
  /** Every contract still on the table at the horizon settles. */
  readonly finalSettlement: 'complete';
  /** The reference assets the profile pins (blackjack), or null. */
  readonly reference: VersionedIdentity | null;
  /**
   * An upper bound, whole units, on every money amount a session can reach:
   * final balance, net loss or gain, turnover and drawdown. Validated against
   * the bound derived from the rules before any statistics.
   */
  readonly exposureBound: string;
}

/** A versioned benchmark profile: the protocol and the full pinned rules (a blackjack profile's include its benchmark seat). */
export type BenchmarkProfile = ProfileBase &
  ({ readonly game: 'roulette'; readonly rules: RouletteRuleSet } | { readonly game: 'craps'; readonly rules: CrapsRuleSet } | { readonly game: 'blackjack'; readonly rules: BlackjackRuleSet });

const largest = (values: readonly Money[]) => values.reduce((a, b) => (compare(a, b) >= 0 ? a : b));
const units = (n: number | bigint) => money(BigInt(n));

/** The most a player can stake on one turn under the rules, and the largest profit per unit staked. */
function turnExposure(profile: BenchmarkProfile): { stake: Money; payout: Money } {
  switch (profile.game) {
    case 'roulette': {
      // Every placement at its own maximum: chips on one target never pass its limit, and there is no aggregate cap.
      const placements = rouletteLayout(profile.rules.wheel);
      const stake = placements.reduce((sum, placement) => add(sum, decodeMoney(profile.rules.limits[placement.limitClass].max)), units(0));
      return { stake, payout: largest(placements.map((placement) => units(placement.payout))) };
    }
    case 'craps':
      return crapsTurnExposure(profile.rules);
    case 'blackjack': {
      // Every hand split to the cap and doubled, plus full insurance; a doubled win or insurance pays at most 2 per unit.
      const initial = decodeMoney(profile.rules.limits.initial.max);
      return { stake: add(mul(initial, units(MAX_SPLIT_HANDS * 2)), mul(initial, money(1n, 2n))), payout: units(2) };
    }
  }
}

/**
 * The monetary-exposure bound the profile's rules imply: the funding plus, for
 * every opportunity and the final settlement, the most a turn can stake and win.
 * Final settlement adds no stakes; each contract it settles resolves once.
 */
export function deriveExposureBound(profile: BenchmarkProfile): string {
  const { stake, payout } = turnExposure(profile);
  const perTurn = mul(stake, add(units(1), payout));
  const bound = add(decodeMoney(profile.funding), mul(perTurn, units(profile.opportunities + 1)));
  // Whole units, rounded up.
  return ((bound.n + bound.d - 1n) / bound.d).toString();
}

/**
 * Problems with a profile's exposure bound: it must equal the bound its rules
 * imply, and stay exactly representable through a full run's aggregates
 * (sessions × bound within 2^53 - 1).
 */
export function exposureBoundProblems(profile: BenchmarkProfile): string[] {
  const problems: string[] = [];
  const derived = deriveExposureBound(profile);
  if (profile.exposureBound !== derived) problems.push(`${profile.id}: the exposure bound is ${profile.exposureBound}, the rules imply ${derived}`);
  if (BigInt(derived) * BigInt(BENCHMARK_PROTOCOL.sessions) > BigInt(Number.MAX_SAFE_INTEGER)) problems.push(`${profile.id}: the exposure bound is too large for exact aggregates`);
  return problems;
}

/**
 * Why a standardized session stopped placing new bets: the horizon (every
 * opportunity used, waiting included), the strategy's explicit stop rule, a
 * cap, a table limit, a required group it can't afford, or an adjustment that
 * left the strategy envelope.
 */
export type StandardizedStopCause = 'horizon' | 'stop' | 'cap' | 'limit' | 'unaffordable' | 'envelope';

export const STANDARDIZED_STOP_CAUSES: readonly StandardizedStopCause[] = ['horizon', 'stop', 'cap', 'limit', 'unaffordable', 'envelope'];

/** One finalized standardized session. No explanation strings. */
export interface StandardizedSessionRecord {
  readonly index: number;
  readonly finalBalance: string;
  /** Final balance minus funding. */
  readonly net: string;
  readonly wins: number;
  readonly losses: number;
  readonly pushes: number;
  /** wins + losses + pushes. */
  readonly resolved: number;
  /** Stakes of the resolved wagers. */
  readonly turnover: string;
  readonly opportunities: number;
  /** Largest fall from a previous peak, stakes at cost, simultaneous settlements aggregated. */
  readonly maxDrawdown: string;
  /** Nothing was ever staked. */
  readonly noBet: boolean;
  readonly stopCause: StandardizedStopCause;
  /** The final balance is exactly zero (unlike an unaffordable next bet with funds left). */
  readonly literalZero: boolean;
  /** Rolls the final settlement took to resolve the contracts left at the stop. */
  readonly settlementLength: number;
}

/** A standardized session between steps: plain data, so it can be checkpointed and resumed. */
export interface StandardizedSession {
  readonly index: number;
  readonly base: string;
  readonly horizon: number;
  readonly activity: ActivityState;
  /** Opportunities used before new bets stopped; null while they go on. */
  readonly opportunities: number | null;
  readonly stop: StandardizedStopCause | null;
  readonly staked: boolean;
  readonly wins: number;
  readonly losses: number;
  readonly pushes: number;
  readonly turnover: string;
}

/** The runner could not follow the strategy exactly: an invalid execution, never scored as a loss. */
export class StandardizedRunError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StandardizedRunError';
  }
}

/** Starts session `index` of a run: the profile's table and funding, the strategy pinned, the server stream. */
export function startStandardizedSession(input: { readonly profile: BenchmarkProfile; readonly strategy: StrategySelection; readonly key: Words2; readonly index: number }): StandardizedSession {
  const { profile, strategy, index } = input;
  const activity = createActivity(
    {
      activityId: `${profile.id}/${index}`,
      owner: 'runner',
      device: 'runner',
      game: profile.game,
      rules: profile.rules,
      strategy,
      reference: profile.reference,
      fundingSource: 'practice-funding',
      funding: profile.funding,
    } as Parameters<typeof createActivity>[0],
    serverStreamIdentity(input.key, index),
  );
  return { index, base: profile.base, horizon: profile.opportunities, activity, opportunities: null, stop: null, staked: false, wins: 0, losses: 0, pushes: 0, turnover: '0' };
}

const STOP_FOR_PAUSE: Readonly<Record<PendingStrategyAction['reason'], StandardizedStopCause>> = { 'unfunded-group': 'unaffordable', limit: 'limit', cap: 'cap', stop: 'stop' };

/** Funds off the table plus removable and committed stakes. */
const available = (state: ActivityState) => state.wagers.reduce((sum, wager) => add(sum, decodeMoney(wager.amount)), decodeMoney(state.balance));

/** The command a runner following the strategy sends next, and how it changes the session's bookkeeping. */
function nextMove(session: StandardizedSession): { command: Command; stop?: StandardizedStopCause; opportunities?: number } | null {
  const state = session.activity;
  const run = state.strategy;
  if (!run) throw new StandardizedRunError('a standardized session needs a strategy');
  switch (state.phase) {
    case 'completed':
      return null;
    case 'final-settlement':
      return { command: { kind: 'advance-final-settlement' } };
    case 'revealing-outcome':
      return { command: { kind: 'settle-turn' } };
    case 'correction':
      throw new StandardizedRunError('the runner departed from the strategy');
    default:
      break;
  }
  // A blackjack hand awaiting a decision: the strategy's play, after its legal and funding fallbacks.
  if (state.identities.game === 'blackjack') {
    const decision = playSituation(state as BlackjackActivityState);
    const policy = policyOf(run.definition);
    if (decision && policy) return { command: moveCommand(prescribePlay(policy, decision.situation, decision.target, decision.hand).prescribed) };
  }
  const stop = (cause: StandardizedStopCause, opportunities = state.turn) => ({ command: { kind: 'request-stop' } as Command, stop: cause, opportunities });
  if (state.turn >= session.horizon) return stop('horizon');
  if (state.phase === 'cycle-completion') {
    switch (run.cycleEnd) {
      case 'completed':
        // The runner policy: a completed cycle restarts at once with the remaining balance.
        return { command: { kind: 'restart-cycle' } };
      case 'cap':
      case 'stop':
      case 'envelope':
        return stop(run.cycleEnd);
      default:
        throw new StandardizedRunError(`a cycle ended by ${String(run.cycleEnd)}`);
    }
  }
  if (run.status !== 'active') throw new StandardizedRunError(`the strategy is ${run.status}`);
  let wanted: readonly { readonly target: string; readonly amount: string }[];
  if (run.definition.instructions.length === 0) {
    // A blackjack strategy that leaves the bets to the player: the profile's base every round.
    if (compare(available(state), decodeMoney(session.base)) < 0) return stop('unaffordable');
    wanted = [{ target: HAND_TARGET, amount: session.base }];
  } else {
    const decision = strategyDecision(state) as NonNullable<ReturnType<typeof strategyDecision>>;
    if (decision.held) return stop(STOP_FOR_PAUSE[decision.held.reason]);
    const { prescription } = decision;
    if (prescription.status === 'paused') return stop(STOP_FOR_PAUSE[prescription.reason]);
    if (prescription.status === 'uncovered') {
      // Nothing to place. Craps rolls on without the player (a waiting roll); elsewhere nothing changes
      // until a turn is played, so the strategy waits out every remaining opportunity.
      if (state.identities.game !== 'craps') return stop('horizon', session.horizon);
      if (state.wagers.length > 0) throw new StandardizedRunError('an uncovered situation with wagers on the table');
      return { command: { kind: 'begin-turn' } };
    }
    wanted = prescription.bets;
  }
  const amountOf = (list: readonly { readonly target: string; readonly amount: string }[], target: string) => list.find((wager) => wager.target === target)?.amount;
  const removal = state.wagers.find((wager) => amountOf(wanted, wager.target) === undefined);
  if (removal) return { command: { kind: 'place-wager', target: removal.target, amount: '0' } };
  const change = wanted.find((bet) => amountOf(state.wagers, bet.target) !== bet.amount);
  if (change) return { command: { kind: 'place-wager', target: change.target, amount: change.amount } };
  return { command: { kind: 'begin-turn' } };
}

/** The session after one more command; a completed session is returned unchanged. Throws StandardizedRunError on an invalid execution. */
export function stepStandardizedSession(session: StandardizedSession): StandardizedSession {
  const move = nextMove(session);
  if (!move) return session;
  const state = session.activity;
  const result = advanceActivity(state, { sequence: state.sequence, commandId: `${state.sequence}`, command: move.command });
  if (result.status !== 'committed') throw new StandardizedRunError(`${move.command.kind} was ${result.status}`);
  const illegal = result.facts.find((fact) => fact.kind === 'illegal-action' || fact.kind === 'correction-offered');
  if (illegal) throw new StandardizedRunError(`${move.command.kind} gave ${illegal.kind}`);
  return { ...tally(session, result.facts), activity: result.state, ...(move.stop ? { stop: move.stop, opportunities: move.opportunities ?? null } : {}) };
}

/** Counts resolved wagers (W/L/P by net result) and turnover; simulated players' settlements are facts of their own, outside it. */
function tally(session: StandardizedSession, facts: readonly DomainFact[]): StandardizedSession {
  let { wins, losses, pushes, staked } = session;
  let turnover = decodeMoney(session.turnover);
  for (const fact of facts) {
    if (fact.kind === 'turn-began' && fact.wagers.length > 0) staked = true;
    if (fact.kind !== 'wager-settled' || fact.result === 'returned') continue;
    const net = compare(decodeMoney(fact.net), units(0));
    if (net > 0) wins++;
    else if (net < 0) losses++;
    else pushes++;
    turnover = add(turnover, decodeMoney(fact.stake));
  }
  return { ...session, wins, losses, pushes, staked, turnover: encodeMoney(turnover) };
}

/** The record of a completed session. */
export function standardizedRecord(session: StandardizedSession): StandardizedSessionRecord {
  const state = session.activity;
  if (state.phase !== 'completed' || session.stop === null || session.opportunities === null) throw new StandardizedRunError(`session ${session.index} is not complete`);
  const balance = decodeMoney(state.balance);
  return {
    index: session.index,
    finalBalance: state.balance,
    net: encodeMoney(sub(balance, decodeMoney(state.funding.buyIn))),
    wins: session.wins,
    losses: session.losses,
    pushes: session.pushes,
    resolved: session.wins + session.losses + session.pushes,
    turnover: session.turnover,
    opportunities: session.opportunities,
    maxDrawdown: state.funding.maxDrawdown,
    noBet: !session.staked,
    stopCause: session.stop,
    literalZero: balance.n === 0n,
    // Turns begun after the stop: the final settlement's rolls.
    settlementLength: state.turn - Math.min(state.turn, session.opportunities),
  };
}

/**
 * Problems with a record against its profile's exposure bound: any amount past
 * it is an integrity error, found before the record reaches any statistics.
 */
export function recordExposureProblems(record: StandardizedSessionRecord, profile: BenchmarkProfile): string[] {
  const bound = decodeMoney(profile.exposureBound);
  const magnitude = (text: string) => {
    const value = decodeMoney(text);
    return value.n < 0n ? money(-value.n, value.d) : value;
  };
  return (['finalBalance', 'net', 'turnover', 'maxDrawdown'] as const)
    .filter((field) => compare(magnitude(record[field]), bound) > 0)
    .map((field) => `session ${record.index}: ${field} ${record[field]} is past the exposure bound ${profile.exposureBound}`);
}

/** Most commands one session may take before the run is declared invalid (a runaway is a defect, never a result). */
const MAX_STEPS = 1_000_000;

/** Runs session `index` to completion and returns its record and final session. */
export function runStandardizedSession(input: Parameters<typeof startStandardizedSession>[0]): { readonly record: StandardizedSessionRecord; readonly session: StandardizedSession } {
  let session = startStandardizedSession(input);
  for (let steps = 0; session.activity.phase !== 'completed'; steps++) {
    if (steps >= MAX_STEPS) throw new StandardizedRunError(`session ${input.index} did not complete`);
    session = stepStandardizedSession(session);
  }
  return { record: standardizedRecord(session), session };
}
