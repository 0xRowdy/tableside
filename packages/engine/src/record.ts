// The completed practice session record and the results summary functions.
// The record is the contract specs 2 (sync, export), 4 (records, ledgers,
// session detail), 5 (metering) and 6 (standardized runs) consume. It is built
// once, purely, from a completed activity and every fact its committed
// transitions produced, so a recovered completion rebuilds the same record.
// It is plain JSON-safe data; money is canonical text.
//
// Quarantine is never stored here (Amendment 3 §1): it is derived by comparing
// the record's pinned identities with a shipped quarantine list, so an
// accepted, immutable record can become quarantined later.

import { readPermittedView, type ActivityState, type GameId, type StrategyDeparture, type VersionedIdentity } from './activity';
import { summarizeFunding, type FundingSource } from './funding';
import { add, compare, decodeMoney, div, encodeMoney, money, type Money } from './money';
import type { DomainFact } from './activity';

/** The record format's version; a field change bumps it. */
export const RECORD_VERSION = 1 as const;

/** How spec 5 meters an activity, as its admission said (Amendment 4 A3). */
export type MeteringBasis = 'free-play' | 'premium' | 'time' | 'turns' | 'training-bankroll' | 'challenge-attempt';

/** Why the stop path ran. The player's stop, reset or switch, or an access-ended stop (which includes a content-removal stop). */
export type StopCause = 'stop' | 'reset' | 'switch' | 'access-ended';

export const STOP_CAUSES: readonly StopCause[] = ['stop', 'reset', 'switch', 'access-ended'];

/**
 * How the session ended (Amendment 2 §B). "quarantined" is for an activity
 * that a proven defect made unusable, ended by #80's path, not the stop path.
 */
export type EndingReason = StopCause | 'quarantined';

/** One wager's outcome, with the turn (round, roll or spin) it belongs to (Amendment 3 §2). */
export interface WagerOutcome {
  /** The turn the wager settled in; for a return between turns, the latest turn begun (0 before any). */
  readonly turn: number;
  readonly target: string;
  readonly stake: string;
  /** "returned": the stake came back without an outcome (a stop-path return, craps odds that were off). */
  readonly result: 'win' | 'loss' | 'push' | 'returned';
  /** Net result after commission: payout on a win, minus the lost amount, 0 on a push or a return. */
  readonly net: string;
  /** Paid back to the balance. */
  readonly returned: string;
}

/** Win, loss and push counts; resolved is their sum (returns are outside it). */
export interface WagerCounts {
  readonly wins: number;
  readonly losses: number;
  readonly pushes: number;
  readonly resolved: number;
}

/** One adherence measure: assessed decisions and how many followed the strategy. */
export interface AdherenceMeasure {
  readonly decisions: number;
  readonly followed: number;
}

/** Playing, counting and betting adherence, kept apart; null where the session didn't assess that kind. */
export interface Adherence {
  readonly playing: AdherenceMeasure | null;
  readonly counting: AdherenceMeasure | null;
  readonly betting: AdherenceMeasure | null;
}

export interface CompletedPracticeSessionRecord {
  readonly recordVersion: typeof RECORD_VERSION;
  readonly activityId: string;
  readonly owner: string;
  readonly device: string;
  readonly game: GameId;
  /** The pinned identities, which quarantine is judged on. */
  readonly identities: {
    readonly engine: string;
    readonly rules: VersionedIdentity;
    readonly strategy: VersionedIdentity | null;
    readonly reference: VersionedIdentity | null;
    readonly randomProtocol: number;
  };
  /** Display and list order only: never sync or progression logic. Milliseconds since the epoch. */
  readonly startedAt: number;
  readonly endedAt: number;
  readonly mode: 'free-play' | 'guided';
  /** The blackjack mode (#77, #78); null for other games and until blackjack modes exist. */
  readonly blackjackMode: string | null;
  /** Whether blackjack's Hi-Lo bet schedule was on (#78); null for other games and until it exists. */
  readonly betSchedule: boolean | null;
  /** The strategy revision run (a built-in or a private revision), with the choices made at setup. Null in free play. */
  readonly strategy: {
    readonly id: string;
    readonly revision: number;
    readonly name: string;
    readonly parameters: Readonly<Record<string, string>>;
  } | null;
  /** The rule preset with its pinned content: limits, wheel, odds cap, blackjack table rules. */
  readonly rules: VersionedIdentity & { readonly content: ActivityState['rules'] };
  readonly fundingSource: FundingSource;
  readonly meteringBasis: MeteringBasis;
  /** The allowance-policy version in force (Amendment 3 §4); null when the supervisor named none. */
  readonly allowancePolicyVersion: string | null;
  /** The initial buy-in, or the training-bankroll allocation. */
  readonly buyIn: string;
  /** Each rebuy, in order. */
  readonly rebuys: readonly string[];
  readonly cumulativeFunding: string;
  readonly finalCashOut: string;
  /** Final cash-out minus cumulative funding. */
  readonly netResult: string;
  /** Largest buy-in-adjusted fall of the game result from a previous peak, including final settlement. */
  readonly maxDrawdown: string;
  readonly turnsPlayed: number;
  readonly endingReason: EndingReason;
  /** Any explicit override in the session; a cycle restart doesn't clear it. */
  readonly overrideAffected: boolean;
  /** This session's W/L/P and resolved-wager counts. */
  readonly wagers: WagerCounts;
  /** No turn was played: nothing was ever at risk. Such sessions stay in session denominators. */
  readonly noBet: boolean;
  /** Detail: every wager outcome and return, in order. */
  readonly outcomes: readonly WagerOutcome[];
  /** Detail, guided practice only: adherence and the append-only departure log, in order. */
  readonly guidance: {
    readonly adherence: Adherence;
    readonly departures: readonly StrategyDeparture[];
  } | null;
}

/** What the record needs from outside the engine: the clock's times and the admission. */
export interface RecordContext {
  readonly startedAt: number;
  readonly endedAt: number;
  readonly meteringBasis: MeteringBasis;
  readonly allowancePolicyVersion: string | null;
}

/** The stop cause a request-stop command carried, read from its receipt. */
function stopCause(state: ActivityState): StopCause {
  for (const receipt of [...state.receipts].reverse()) {
    const command = JSON.parse(receipt.command) as { kind: string; cause?: StopCause };
    if (command.kind === 'request-stop') return command.cause ?? 'stop';
  }
  return 'stop';
}

/** Every wager outcome and return in the facts, each with its turn. */
function wagerOutcomes(facts: readonly DomainFact[]): WagerOutcome[] {
  const outcomes: WagerOutcome[] = [];
  let turn = 0;
  for (const fact of facts) {
    if (fact.kind === 'turn-began') turn = fact.turn;
    else if (fact.kind === 'wager-settled') {
      outcomes.push({ turn: fact.turn, target: fact.target, stake: fact.stake, result: fact.result, net: fact.net, returned: fact.returned });
    } else if (fact.kind === 'wager-returned') {
      outcomes.push({ turn, target: fact.target, stake: fact.amount, result: 'returned', net: '0', returned: fact.amount });
    }
  }
  return outcomes;
}

/**
 * The completed practice session record for a completed activity and every
 * fact its committed transitions produced, in commit order. Throws unless the
 * activity is completed.
 */
export function completedPracticeRecord(state: ActivityState, facts: readonly DomainFact[], context: RecordContext): CompletedPracticeSessionRecord {
  if (state.phase !== 'completed') throw new Error(`activity ${state.activity.id} is not completed`);
  // Completed: nothing is left on the table, so the balance is the final cash-out.
  const funding = summarizeFunding(state.funding, decodeMoney(state.balance));
  const strategy = readPermittedView(state).strategy;
  const run = state.strategy;
  const outcomes = wagerOutcomes(facts);
  return {
    recordVersion: RECORD_VERSION,
    activityId: state.activity.id,
    owner: state.activity.owner,
    device: state.activity.device,
    game: state.identities.game,
    identities: {
      engine: state.identities.engine,
      rules: state.identities.rules,
      strategy: state.identities.strategy,
      reference: state.identities.reference,
      randomProtocol: state.identities.random.protocol,
    },
    startedAt: context.startedAt,
    endedAt: context.endedAt,
    mode: run ? 'guided' : 'free-play',
    blackjackMode: null,
    betSchedule: null,
    strategy: run && { id: run.definition.id, revision: run.definition.revision, name: run.definition.name, parameters: { ...run.parameters } },
    rules: { ...state.identities.rules, content: state.rules },
    fundingSource: funding.source,
    meteringBasis: context.meteringBasis,
    allowancePolicyVersion: context.allowancePolicyVersion,
    buyIn: funding.buyIn,
    rebuys: funding.rebuys,
    cumulativeFunding: funding.cumulativeFunding,
    finalCashOut: funding.finalCashOut,
    netResult: funding.netResult,
    maxDrawdown: funding.maxDrawdown,
    turnsPlayed: state.turn,
    endingReason: stopCause(state),
    overrideAffected: strategy?.overrideAffected ?? false,
    wagers: countWagers(outcomes),
    noBet: state.turn === 0,
    outcomes,
    guidance: strategy && {
      // Today's strategies (roulette) assess betting decisions only; blackjack adds playing and counting.
      adherence: { betting: { decisions: strategy.adherence.decisions, followed: strategy.adherence.followed }, playing: null, counting: null },
      departures: strategy.departures,
    },
  };
}

// ---- results summary functions (Amendment 2 §A.4) ------------------------

const ZERO = money(0n);

/** A wager by net result after commission; null for one returned without an outcome. */
export function classifyWager(outcome: Pick<WagerOutcome, 'result' | 'net'>): 'win' | 'loss' | 'push' | null {
  if (outcome.result === 'returned') return null;
  return ({ 1: 'win', [-1]: 'loss', 0: 'push' } as const)[compare(decodeMoney(outcome.net), ZERO)];
}

/** W/L/P counts over separate wagers (each split hand, insurance, odds bet, horn component and placement is one). */
export function countWagers(outcomes: readonly Pick<WagerOutcome, 'result' | 'net'>[]): WagerCounts {
  let wins = 0;
  let losses = 0;
  let pushes = 0;
  for (const outcome of outcomes) {
    const kind = classifyWager(outcome);
    if (kind === 'win') wins++;
    else if (kind === 'loss') losses++;
    else if (kind === 'push') pushes++;
  }
  return { wins, losses, pushes, resolved: wins + losses + pushes };
}

export type SessionClass = 'profitable' | 'losing' | 'unchanged';

export function classifySession(record: Pick<CompletedPracticeSessionRecord, 'netResult'>): SessionClass {
  return ({ 1: 'profitable', [-1]: 'losing', 0: 'unchanged' } as const)[compare(decodeMoney(record.netResult), ZERO)];
}

/** count of `of`, pooled sum over sum; null when there is nothing to divide by. */
export type Share = { readonly count: number; readonly of: number } | null;

const share = (count: number, of: number): Share => (of === 0 ? null : { count, of });

export interface ResultsSummary {
  readonly sessions: {
    /** Sessions in the totals (no-bet sessions included, quarantined ones not). */
    readonly count: number;
    readonly profitable: number;
    readonly losing: number;
    readonly unchanged: number;
    readonly noBet: number;
    /** Sessions left out because they are quarantined. */
    readonly quarantined: number;
  };
  readonly sessionShares: Record<SessionClass, Share>;
  readonly wagers: WagerCounts;
  readonly wagerShares: { readonly win: Share; readonly loss: Share; readonly push: Share };
  /** The median and the worst of the sessions' maximum drawdowns; null with no sessions. */
  readonly drawdown: { readonly median: string | null; readonly worst: string | null };
  /** Followed over assessed decisions, pooled per kind; null where no session assessed that kind. */
  readonly adherence: Record<keyof Adherence, Share>;
}

function median(values: Money[]): Money | null {
  const sorted = [...values].sort(compare);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length === 0) return null;
  if (sorted.length % 2 === 1) return sorted[middle] as Money;
  return div(add(sorted[middle - 1] as Money, sorted[middle] as Money), money(2n));
}

/**
 * Totals over completed records (personal totals in spec 4, standardized runs
 * in spec 6). Quarantined records, judged against `quarantine`, are left out
 * of every total and of adherence.
 */
export function summarizeResults(records: readonly CompletedPracticeSessionRecord[], quarantine: QuarantineList = EMPTY_QUARANTINE_LIST): ResultsSummary {
  const included = records.filter((record) => !quarantineStatus(record, quarantine).quarantined);
  const classes = { profitable: 0, losing: 0, unchanged: 0 };
  let wins = 0;
  let losses = 0;
  let pushes = 0;
  const adherence = { playing: [0, 0], counting: [0, 0], betting: [0, 0] } as Record<keyof Adherence, [number, number]>;
  const seen = new Set<keyof Adherence>();
  for (const record of included) {
    classes[classifySession(record)]++;
    wins += record.wagers.wins;
    losses += record.wagers.losses;
    pushes += record.wagers.pushes;
    for (const kind of ['playing', 'counting', 'betting'] as const) {
      const measure = record.guidance?.adherence[kind];
      if (!measure) continue;
      seen.add(kind);
      adherence[kind][0] += measure.followed;
      adherence[kind][1] += measure.decisions;
    }
  }
  const count = included.length;
  const resolved = wins + losses + pushes;
  const drawdowns = included.map((record) => decodeMoney(record.maxDrawdown));
  const middle = median(drawdowns);
  const worst = drawdowns.reduce<Money | null>((most, value) => (most === null || compare(value, most) > 0 ? value : most), null);
  const pooled = (kind: keyof Adherence) => (seen.has(kind) ? share(adherence[kind][0], adherence[kind][1]) : null);
  return {
    sessions: { count, ...classes, noBet: included.filter((record) => record.noBet).length, quarantined: records.length - count },
    sessionShares: { profitable: share(classes.profitable, count), losing: share(classes.losing, count), unchanged: share(classes.unchanged, count) },
    wagers: { wins, losses, pushes, resolved },
    wagerShares: { win: share(wins, resolved), loss: share(losses, resolved), push: share(pushes, resolved) },
    drawdown: { median: middle && encodeMoney(middle), worst: worst && encodeMoney(worst) },
    adherence: { playing: pooled('playing'), counting: pooled('counting'), betting: pooled('betting') },
  };
}

// ---- quarantine (Amendment 3 §1) -----------------------------------------

/** One quarantined combination: every identity it names must match. */
export interface QuarantineEntry {
  readonly id: string;
  readonly match: {
    readonly engine?: string;
    readonly rules?: VersionedIdentity;
    readonly strategy?: VersionedIdentity;
    readonly reference?: VersionedIdentity;
  };
  /** Shown with the quarantined session. */
  readonly explanation: string;
}

/** The versioned list shipped with the app (and mirrored on the server, Amendment 6 §6). Plain data. */
export interface QuarantineList {
  readonly version: number;
  readonly entries: readonly QuarantineEntry[];
}

export const EMPTY_QUARANTINE_LIST: QuarantineList = { version: 0, entries: [] };

export type QuarantineStatus = { readonly quarantined: false } | { readonly quarantined: true; readonly entry: string; readonly explanation: string };

const sameIdentity = (a: VersionedIdentity | null, b: VersionedIdentity) => a !== null && a.id === b.id && a.version === b.version;

/** Whether a record's pinned identities fall under the list; derived on every read, never stored. */
export function quarantineStatus(record: Pick<CompletedPracticeSessionRecord, 'identities'>, list: QuarantineList): QuarantineStatus {
  const { identities } = record;
  for (const entry of list.entries) {
    const { engine, rules, strategy, reference } = entry.match;
    // An entry naming no identity quarantines nothing.
    if (engine === undefined && !rules && !strategy && !reference) continue;
    if (engine !== undefined && engine !== identities.engine) continue;
    if (rules && !sameIdentity(identities.rules, rules)) continue;
    if (strategy && !sameIdentity(identities.strategy, strategy)) continue;
    if (reference && !sameIdentity(identities.reference, reference)) continue;
    return { quarantined: true, entry: entry.id, explanation: entry.explanation };
  }
  return { quarantined: false };
}
