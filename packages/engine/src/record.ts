// Spec 1 Amendment 2 §B
// docs/development.md Releases: recorded checkpoints and the quarantine list

import { readPermittedView, stopCause, type ActivityState, type AdherenceMeasure, type GameId, type StopCause, type StrategyDeparture, type VersionedIdentity } from './activity';
import { summarizeFunding, type FundingSource } from './funding';
import { add, compare, decodeMoney, div, encodeMoney, money, type Money } from './money';
import type { DomainFact } from './activity';
import { blackjackModeOf, policyOf, type BlackjackMode } from './blackjack-strategy';
import type { StrategyDefinition } from './strategy';

export const RECORD_VERSION = 1 as const;

// Spec 1 Amendment 4 A3
export type MeteringBasis = 'free-play' | 'premium' | 'time' | 'turns' | 'training-bankroll' | 'challenge-attempt';

// Spec 1 Amendment 2 §B, #80
export type EndingReason = StopCause | 'quarantined';

// Spec 1 Amendment 3 §2
export interface WagerOutcome {
  readonly turn: number;
  readonly target: string;
  readonly stake: string;
  readonly result: 'win' | 'loss' | 'push' | 'returned';
  readonly net: string;
  readonly returned: string;
  readonly component?: number;
  readonly commission?: string;
}

export interface WagerCounts {
  readonly wins: number;
  readonly losses: number;
  readonly pushes: number;
  readonly resolved: number;
}

export type { AdherenceMeasure } from './activity';

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
  readonly identities: {
    readonly engine: string;
    readonly rules: VersionedIdentity;
    readonly strategy: VersionedIdentity | null;
    readonly reference: VersionedIdentity | null;
    readonly randomProtocol: number;
  };
  readonly startedAt: number;
  readonly endedAt: number;
  readonly mode: 'free-play' | 'guided';
  readonly blackjackMode: BlackjackMode | null;
  readonly betSchedule: boolean | null;
  readonly strategy: {
    readonly id: string;
    readonly revision: number;
    readonly name: string;
    readonly parameters: Readonly<Record<string, string>>;
  } | null;
  readonly rules: VersionedIdentity & { readonly content: ActivityState['rules'] };
  readonly fundingSource: FundingSource;
  readonly meteringBasis: MeteringBasis;
  // Spec 1 Amendment 3 §4
  readonly allowancePolicyVersion: string | null;
  readonly buyIn: string;
  readonly rebuys: readonly string[];
  readonly cumulativeFunding: string;
  readonly finalCashOut: string;
  readonly netResult: string;
  readonly maxDrawdown: string;
  readonly turnsPlayed: number;
  readonly endingReason: EndingReason;
  readonly overrideAffected: boolean;
  readonly wagers: WagerCounts;
  readonly noBet: boolean;
  readonly outcomes: readonly WagerOutcome[];
  readonly guidance: {
    readonly adherence: Adherence;
    readonly departures: readonly StrategyDeparture[];
  } | null;
}

export interface RecordContext {
  readonly startedAt: number;
  readonly endedAt: number;
  readonly meteringBasis: MeteringBasis;
  readonly allowancePolicyVersion: string | null;
}

function wagerOutcomes(facts: readonly DomainFact[]): WagerOutcome[] {
  const outcomes: WagerOutcome[] = [];
  let turn = 0;
  for (const fact of facts) {
    if (fact.kind === 'turn-began') turn = fact.turn;
    else if (fact.kind === 'wager-settled') {
      outcomes.push({
        turn: fact.turn,
        target: fact.target,
        stake: fact.stake,
        result: fact.result,
        net: fact.net,
        returned: fact.returned,
        ...(fact.component === undefined ? {} : { component: fact.component }),
        ...(fact.commission === undefined ? {} : { commission: fact.commission }),
      });
    } else if (fact.kind === 'wager-returned') {
      outcomes.push({ turn, target: fact.target, stake: fact.amount, result: 'returned', net: '0', returned: fact.amount });
    }
  }
  return outcomes;
}

function turnsOf(facts: readonly DomainFact[]): { played: number; staked: boolean } {
  let played = 0;
  let staked = false;
  for (const fact of facts) {
    if (fact.kind === 'stop-requested') break;
    if (fact.kind !== 'turn-began') continue;
    played = fact.turn;
    if (fact.wagers.length > 0) staked = true;
  }
  return { played, staked };
}

function blackjackMode(definition: StrategyDefinition): BlackjackMode | null {
  const play = policyOf(definition);
  return definition.game === 'blackjack' && play ? blackjackModeOf(play) : null;
}

export function completedPracticeRecord(state: ActivityState, facts: readonly DomainFact[], context: RecordContext): CompletedPracticeSessionRecord {
  if (state.phase !== 'completed') throw new Error(`activity ${state.activity.id} is not completed`);
  const funding = summarizeFunding(state.funding, decodeMoney(state.balance));
  const strategy = readPermittedView(state).strategy;
  const run = state.strategy;
  const outcomes = wagerOutcomes(facts);
  const turns = turnsOf(facts);
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
    blackjackMode: run ? blackjackMode(run.definition) : null,
    betSchedule: state.identities.game === 'blackjack' ? run !== null && run.definition.instructions.length > 0 : null,
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
    turnsPlayed: turns.played,
    endingReason: stopCause(state),
    overrideAffected: strategy?.overrideAffected ?? false,
    wagers: countWagers(outcomes),
    noBet: !turns.staked,
    outcomes,
    guidance: strategy && {
      // TODO(spec 3 count checkpoints)
      adherence: { betting: strategy.adherence.betting, playing: strategy.adherence.playing, counting: null },
      departures: strategy.departures,
    },
  };
}

// Spec 1 Amendment 2 §A.4

const ZERO = money(0n);

export function classifyWager(outcome: Pick<WagerOutcome, 'result' | 'net'>): 'win' | 'loss' | 'push' | null {
  if (outcome.result === 'returned') return null;
  return ({ 1: 'win', [-1]: 'loss', 0: 'push' } as const)[compare(decodeMoney(outcome.net), ZERO)];
}

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

export type Share = { readonly count: number; readonly of: number } | null;

const share = (count: number, of: number): Share => (of === 0 ? null : { count, of });

export interface ResultsSummary {
  readonly sessions: {
    readonly count: number;
    readonly profitable: number;
    readonly losing: number;
    readonly unchanged: number;
    readonly noBet: number;
    readonly quarantined: number;
  };
  readonly sessionShares: Record<SessionClass, Share>;
  readonly wagers: WagerCounts;
  readonly wagerShares: { readonly win: Share; readonly loss: Share; readonly push: Share };
  readonly drawdown: { readonly median: string | null; readonly worst: string | null };
  readonly adherence: Record<keyof Adherence, Share>;
}

function median(values: Money[]): Money | null {
  const sorted = [...values].sort(compare);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length === 0) return null;
  if (sorted.length % 2 === 1) return sorted[middle] as Money;
  return div(add(sorted[middle - 1] as Money, sorted[middle] as Money), money(2n));
}

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

// Spec 1 Amendment 3 §1

export interface QuarantineEntry {
  readonly id: string;
  readonly match: {
    readonly engine?: string;
    readonly rules?: VersionedIdentity;
    readonly strategy?: VersionedIdentity;
    readonly reference?: VersionedIdentity;
  };
  readonly explanation: string;
}

// Spec 1 Amendment 6 §6
export interface QuarantineList {
  readonly version: number;
  readonly entries: readonly QuarantineEntry[];
}

export const EMPTY_QUARANTINE_LIST: QuarantineList = { version: 0, entries: [] };

export type QuarantineStatus = { readonly quarantined: false } | { readonly quarantined: true; readonly entry: string; readonly explanation: string };

const sameIdentity = (a: VersionedIdentity | null, b: VersionedIdentity) => a !== null && a.id === b.id && a.version === b.version;

export interface QuarantinableIdentities {
  readonly engine: string;
  // Spec 3 Attempt lifecycle (unusable); #135
  readonly rules: VersionedIdentity | null;
  readonly strategy: VersionedIdentity | null;
  readonly reference: VersionedIdentity | null;
}

export function quarantineStatus(record: { readonly identities: QuarantinableIdentities }, list: QuarantineList): QuarantineStatus {
  const { identities } = record;
  for (const entry of list.entries) {
    const { engine, rules, strategy, reference } = entry.match;
    if (engine === undefined && !rules && !strategy && !reference) continue;
    if (engine !== undefined && engine !== identities.engine) continue;
    if (rules && !sameIdentity(identities.rules, rules)) continue;
    if (strategy && !sameIdentity(identities.strategy, strategy)) continue;
    if (reference && !sameIdentity(identities.reference, reference)) continue;
    return { quarantined: true, entry: entry.id, explanation: entry.explanation };
  }
  return { quarantined: false };
}
