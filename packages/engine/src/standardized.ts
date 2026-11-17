// Spec 1 Amendment 6 §1, §2
// docs/development.md Game rules spec 1 leaves open

import {
  advanceActivity,
  createActivity,
  gameModule,
  strategyDecision,
  strategyPlay,
  type ActivityState,
  type Command,
  type DomainFact,
  type PendingStrategyAction,
} from './activity';
import type { BlackjackRuleSet } from './blackjack';
import type { CrapsRuleSet } from './craps';
import { add, compare, decodeMoney, encodeMoney, money, mul, sub, type Money } from './money';
import { serverStreamIdentity } from './random';
import type { RouletteRuleSet } from './roulette';
import type { VersionedIdentity } from './shape';
import type { StrategySelection } from './strategy';
import type { Words2 } from './philox';

// Spec 6 Benchmark profiles
export const BENCHMARK_PROTOCOL = { funding: '1000', base: '10', opportunities: 200, sessions: 100_000 } as const;

interface ProfileBase {
  readonly id: string;
  readonly version: number;
  readonly funding: string;
  readonly base: string;
  readonly opportunities: number;
  readonly finalSettlement: 'complete';
  readonly reference: VersionedIdentity | null;
  readonly exposureBound: string;
}

export type BenchmarkProfile = ProfileBase &
  ({ readonly game: 'roulette'; readonly rules: RouletteRuleSet } | { readonly game: 'craps'; readonly rules: CrapsRuleSet } | { readonly game: 'blackjack'; readonly rules: BlackjackRuleSet });

const units = (n: number | bigint) => money(BigInt(n));

const turnExposure = (profile: BenchmarkProfile): { stake: Money; payout: Money } => gameModule(profile.game).turnExposure(profile.rules as never);

export function deriveExposureBound(profile: BenchmarkProfile): string {
  const { stake, payout } = turnExposure(profile);
  const perTurn = mul(stake, add(units(1), payout));
  const bound = add(decodeMoney(profile.funding), mul(perTurn, units(profile.opportunities + 1)));
  return ((bound.n + bound.d - 1n) / bound.d).toString();
}

export function exposureBoundProblems(profile: BenchmarkProfile): string[] {
  const problems: string[] = [];
  const derived = deriveExposureBound(profile);
  if (profile.exposureBound !== derived) problems.push(`${profile.id}: the exposure bound is ${profile.exposureBound}, the rules imply ${derived}`);
  if (BigInt(derived) * BigInt(BENCHMARK_PROTOCOL.sessions) > BigInt(Number.MAX_SAFE_INTEGER)) problems.push(`${profile.id}: the exposure bound is too large for exact aggregates`);
  return problems;
}

export type StandardizedStopCause = 'horizon' | 'stop' | 'cap' | 'limit' | 'unaffordable' | 'envelope';

export const STANDARDIZED_STOP_CAUSES: readonly StandardizedStopCause[] = ['horizon', 'stop', 'cap', 'limit', 'unaffordable', 'envelope'];

export interface StandardizedSessionRecord {
  readonly index: number;
  readonly finalBalance: string;
  readonly net: string;
  readonly wins: number;
  readonly losses: number;
  readonly pushes: number;
  readonly resolved: number;
  readonly turnover: string;
  readonly opportunities: number;
  readonly maxDrawdown: string;
  readonly noBet: boolean;
  readonly stopCause: StandardizedStopCause;
  readonly literalZero: boolean;
  readonly settlementLength: number;
}

export interface StandardizedSession {
  readonly index: number;
  readonly base: string;
  readonly horizon: number;
  readonly activity: ActivityState;
  readonly opportunities: number | null;
  readonly stop: StandardizedStopCause | null;
  readonly staked: boolean;
  readonly wins: number;
  readonly losses: number;
  readonly pushes: number;
  readonly turnover: string;
}

export class StandardizedRunError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StandardizedRunError';
  }
}

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

const available = (state: ActivityState) => state.wagers.reduce((sum, wager) => add(sum, decodeMoney(wager.amount)), decodeMoney(state.balance));

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
  const play = strategyPlay(state);
  if (play) return { command: play };
  const game = gameModule(state.identities.game);
  const stop = (cause: StandardizedStopCause, opportunities = state.turn) => ({ command: { kind: 'request-stop' } as Command, stop: cause, opportunities });
  if (state.turn >= session.horizon) return stop('horizon');
  if (state.phase === 'cycle-completion' || state.phase === 'strategy-settlement') {
    switch (run.cycleEnd) {
      case 'completed':
        return { command: { kind: state.phase === 'strategy-settlement' ? 'advance-strategy-settlement' : 'restart-cycle' } };
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
    if (!game.ownBetTarget) throw new StandardizedRunError('the strategy places no bets');
    if (compare(available(state), decodeMoney(session.base)) < 0) return stop('unaffordable');
    wanted = [{ target: game.ownBetTarget, amount: session.base }];
  } else {
    const decision = strategyDecision(state) as NonNullable<ReturnType<typeof strategyDecision>>;
    if (decision.held) return stop(STOP_FOR_PAUSE[decision.held.reason]);
    const { prescription } = decision;
    if (prescription.status === 'paused') return stop(STOP_FOR_PAUSE[prescription.reason]);
    if (prescription.status === 'uncovered') {
      if (!game.idleTurn) throw new StandardizedRunError(`a waiting ${state.identities.game} turn is not supported`);
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
    settlementLength: state.turn - Math.min(state.turn, session.opportunities),
  };
}

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

const MAX_STEPS = 1_000_000;

export function runStandardizedSession(input: Parameters<typeof startStandardizedSession>[0]): { readonly record: StandardizedSessionRecord; readonly session: StandardizedSession } {
  let session = startStandardizedSession(input);
  for (let steps = 0; session.activity.phase !== 'completed'; steps++) {
    if (steps >= MAX_STEPS) throw new StandardizedRunError(`session ${input.index} did not complete`);
    session = stepStandardizedSession(session);
  }
  return { record: standardizedRecord(session), session };
}
