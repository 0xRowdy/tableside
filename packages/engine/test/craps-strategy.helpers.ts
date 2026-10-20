// Drives guided craps sessions for the craps strategy cases: the player
// follows what Explain prescription says for the situation the permitted view
// shows, one decision at a time.
import {
  advanceActivity,
  createActivity,
  explainPrescription,
  RANDOM_PROTOCOL_VERSION,
  readPermittedView,
  type ActivityState,
  type Command,
  type CrapsPermittedView,
  type CrapsSituation,
  type DomainFact,
  type Prescription,
  type RandomStreamIdentity,
  type StrategyDefinition,
} from '../src';

import { CRAPS_SPEC } from './craps.cases';

export const keyed = (k: number): RandomStreamIdentity => ({ protocol: RANDOM_PROTOCOL_VERSION, key: [k, 0], session: [0, 0] });

export const place = (target: string, amount: string): Command => ({ kind: 'place-wager', target, amount });
export const ROLL: Command = { kind: 'begin-turn' };
export const SETTLE: Command = { kind: 'settle-turn' };

export const crapsView = (state: ActivityState) => readPermittedView(state) as CrapsPermittedView;

export function guidedCraps(definition: StrategyDefinition, stream: RandomStreamIdentity, extra: { funding?: string; flatMax?: string } = {}) {
  const rules = { ...CRAPS_SPEC.rules, limits: { ...CRAPS_SPEC.rules.limits, flat: { min: '10', max: extra.flatMax ?? '1000' } } };
  return createActivity({ ...CRAPS_SPEC, rules, funding: extra.funding ?? '1000', strategy: { definition, parameters: {} } }, stream);
}

/** The situation as the player sees it: the puck, the bases on the table, and every funds for the next roll. */
export function situationOf(state: ActivityState): CrapsSituation {
  const view = crapsView(state);
  const point = view.table.point;
  const established = (target: string) => /^(dont-)?come-\d+$/.test(target) || (point !== null && (target === 'pass' || target === 'dont-pass'));
  const onTable = view.wagers.reduce((sum, wager) => sum + BigInt(wager.amount), 0n);
  return {
    game: 'craps',
    rules: { odds: view.table.odds, field: view.table.field, limits: view.table.limits },
    balance: (BigInt(view.balance) + onTable).toString(),
    point,
    bases: view.wagers.filter((wager) => established(wager.target)).map((wager) => ({ target: wager.target, amount: wager.amount })),
  };
}

/** What Explain prescription says now, from the strategy state (with any adjustment still waiting). */
export function prescriptionNow(state: ActivityState): Prescription {
  const run = state.strategy as NonNullable<ActivityState['strategy']>;
  const explained = explainPrescription(run.definition, run.parameters, situationOf(state), run.deferred?.progress ?? run.progress);
  if (!explained.ok) throw new Error(explained.error);
  return explained.explanation.prescription;
}

export function send(state: ActivityState, command: Command): { state: ActivityState; facts: readonly DomainFact[] } {
  const result = advanceActivity(state, { sequence: state.sequence, commandId: `c${state.sequence}`, command });
  if (result.status !== 'committed') throw new Error(`${command.kind}: ${JSON.stringify(result)}`);
  return { state: result.state, facts: result.facts };
}

export interface Decision {
  /** The table the roll began with, "target amount" each. */
  readonly bets: string;
  readonly total: number;
  readonly point: number | null;
  readonly balance: string;
}

/**
 * Follows the prescription for up to `rolls` rolls: sets the table to exactly
 * the prescribed wagers, rolls, settles. Stops early at a pending action,
 * a correction or a cycle completion.
 */
export function follow(state: ActivityState, rolls: number): { state: ActivityState; decisions: Decision[]; facts: DomainFact[] } {
  const decisions: Decision[] = [];
  const facts: DomainFact[] = [];
  const go = (command: Command) => {
    const next = send(state, command);
    state = next.state;
    facts.push(...next.facts);
    return next;
  };
  for (let i = 0; i < rolls; i++) {
    if (crapsView(state).strategy?.pending || state.phase === 'cycle-completion') break;
    const prescription = prescriptionNow(state);
    const wanted = prescription.status === 'prescribed' ? prescription.bets : [];
    for (const wager of state.wagers) if (!wanted.some((bet) => bet.target === wager.target)) go(place(wager.target, '0'));
    for (const bet of wanted) if (state.wagers.find((wager) => wager.target === bet.target)?.amount !== bet.amount) go(place(bet.target, bet.amount));
    const bets = state.wagers.map((wager) => `${wager.target} ${wager.amount}`).join(', ');
    go(ROLL);
    if (state.phase === 'correction') break;
    go(SETTLE);
    const dice = crapsView(state).outcome?.dice as readonly [number, number];
    decisions.push({ bets, total: dice[0] + dice[1], point: crapsView(state).table.point, balance: state.balance });
  }
  return { state, decisions, facts };
}
