// Spec 3 Modules › Engine; Challenge content; Learn, Check and assistance; #158, #132–#134, #137

import { STATE_SCHEMA_VERSION, type PlayCorrection, type Receipt, type RejectionReason, type VersionedIdentity } from './activity';
import { hiLoTag, truncatedTrueCount, type HandTotal } from './blackjack';
import { prescribeAtTrueCount, type PlayChoice } from './blackjack-strategy';
import { canonicalJson } from './canonical';
import { canonicalShoe, shuffle, type Rank, type Suit } from './draws';
import { RANDOM_PROTOCOL_VERSION, RandomStream, uniformInt, type RandomStreamIdentity, type RandomStreamState } from './random';
import { sha256Hex } from './sha256';
import { hasExactKeys, isCount, isRecord, isText } from './shape';
import {
  cardOf,
  copyTableSetup,
  currentDecision,
  dealTableRound,
  openPlaySeat,
  playMove,
  tableContentProblem,
  tableCountAt,
  tableCountRange,
  tableRunningExplanation,
  tableSetupProblem,
  tableView,
  type CheckpointTiming,
  type PlayDecision,
  type PlaySetup,
  type TableContent,
  type TableCount,
  type TableProgress,
  type TableRunningExplanation,
  type TableSetup,
  type TableStep,
  type TableView,
} from './table-challenge';
import { ENGINE_VERSION } from './version';

export type ChallengeCategory = 'card-values' | 'running-count' | 'conversion' | 'table';

export const CHALLENGE_CATEGORIES: readonly ChallengeCategory[] = ['card-values', 'running-count', 'conversion', 'table'];

export type ChallengeVariant = 'learn' | 'check';

export const CHALLENGE_VARIANTS: readonly ChallengeVariant[] = ['learn', 'check'];

// Spec 3 Modules › Definitions package
export interface CardValuesContent {
  readonly category: 'card-values';
  readonly id: string;
  readonly version: number;
  readonly length: number;
  readonly coverage: 'every-rank';
}

// Spec 3 Challenge content › Running count
export interface RunningCountContent {
  readonly category: 'running-count';
  readonly id: string;
  readonly version: number;
  readonly length: number;
  readonly decks: number;
  readonly checkpoints: readonly number[];
  readonly reference: VersionedIdentity;
}

// Spec 3 Challenge content › Conversion
export interface ConversionContent {
  readonly category: 'conversion';
  readonly id: string;
  readonly version: number;
  readonly length: number;
  readonly maxRunningCount: number;
  readonly maxDecks: number;
}

export type ChallengeContent = CardValuesContent | RunningCountContent | ConversionContent | TableContent;

export interface ChallengeSpecification {
  readonly attemptId: string;
  readonly owner: string;
  readonly device: string;
  readonly variant: ChallengeVariant;
  readonly content: ChallengeContent;
  // Spec 3 Challenge content › Table
  readonly table?: TableSetup;
}

export type HiLoValue = -1 | 0 | 1;

export const HI_LO_VALUES: readonly HiLoValue[] = [1, 0, -1];

export interface ChallengeCard {
  readonly rank: Rank;
  readonly suit: Suit;
}

export interface CardValueItem {
  readonly card: ChallengeCard;
}

// Spec 3 Challenge content › Conversion
export interface ConversionItem {
  readonly running: number;
  readonly decks: number;
}

// Spec 3 Challenge content › Table
export type ChallengeItem = CardValueItem | ConversionItem | TableStep;

export type ChallengeEntry = number | 'skip';

export interface ItemAnswers {
  readonly position: number;
  readonly first: ChallengeEntry;
  readonly last: ChallengeEntry;
  readonly tries: number;
}

// Spec 3 Challenge content › Running count
// Spec 3 User stories 37, 38 (Play decisions and the Learn correction pause); #138
export type ChallengePhase = 'ready' | 'card' | 'question' | 'explanation' | 'recorded' | 'decision' | 'correction' | 'ended';

export type ChallengeEnding = 'completed' | 'abandoned';

export interface ChallengeState {
  readonly schema: typeof STATE_SCHEMA_VERSION;
  readonly attempt: { readonly id: string; readonly owner: string; readonly device: string };
  readonly identities: {
    readonly engine: string;
    readonly category: ChallengeCategory;
    readonly content: VersionedIdentity;
    readonly reference: VersionedIdentity | null;
    readonly random: RandomStreamIdentity;
  };
  readonly variant: ChallengeVariant;
  readonly content: ChallengeContent;
  readonly sequence: number;
  readonly phase: ChallengePhase;
  readonly ending: ChallengeEnding | null;
  readonly position: number;
  readonly items: readonly ChallengeItem[];
  readonly rejected: number;
  readonly answers: readonly ItemAnswers[];
  // Spec 3 Learn, Check and assistance › Show/hide running count
  readonly revealedAt: number | null;
  // Spec 3 Challenge content › Table
  readonly table: TableProgress | null;
  readonly random: RandomStreamState;
  readonly receipts: readonly Receipt[];
}

export type ChallengeCommand =
  | { readonly kind: 'begin' }
  | { readonly kind: 'answer'; readonly value: number }
  | { readonly kind: 'skip' }
  | { readonly kind: 'retry-item' }
  | { readonly kind: 'next-item' }
  // Spec 3 Learn, Check and assistance › Show/hide running count
  | { readonly kind: 'reveal-count' }
  // Spec 3 Training service interface › Submit command (playing action, retry/override); #138
  | { readonly kind: 'play'; readonly action: PlayChoice }
  | { readonly kind: 'retry-correction' }
  | { readonly kind: 'override-correction' }
  | { readonly kind: 'end' };

export type ChallengeCommandKind = ChallengeCommand['kind'];

export interface ChallengeEnvelope {
  readonly sequence: number;
  readonly commandId: string;
  readonly command: ChallengeCommand;
}

export type ChallengeFact =
  | { readonly kind: 'content-shown'; readonly position: number }
  // Spec 3 Count checkpoints (table), Audio and haptics: cue 11
  | { readonly kind: 'checkpoint-due'; readonly position: number }
  // Spec 3 Challenge content › Reshuffle
  | { readonly kind: 'shoe-shuffled'; readonly position: number }
  | { readonly kind: 'answer-accepted'; readonly position: number; readonly scored: boolean }
  // Spec 3 Learn, Check and assistance › Check: cue 9 is a legality event; #138
  | { readonly kind: 'move-refused'; readonly position: number; readonly action: PlayChoice }
  // Spec 3 Audio and haptics: cue 15, Amendment 1 B4; #138
  | { readonly kind: 'correction-offered'; readonly position: number }
  | { readonly kind: 'attempt-ended'; readonly ending: ChallengeEnding };

export type ChallengeAdvance =
  | { readonly status: 'committed'; readonly state: ChallengeState; readonly facts: readonly ChallengeFact[]; readonly receipt: Receipt }
  | { readonly status: 'duplicate'; readonly receipt: Receipt }
  | { readonly status: 'rejected'; readonly reason: RejectionReason; readonly message: string };

// Spec 3 Scoring and review
export type ChallengeMetric = 'card-values' | 'running-count' | 'true-count' | 'playing-adherence' | 'betting-adherence';

export const CHALLENGE_METRICS: readonly ChallengeMetric[] = ['card-values', 'running-count', 'true-count', 'playing-adherence', 'betting-adherence'];

export interface MetricResult {
  readonly correct: number;
  readonly total: number;
}

export type ChallengeMetrics = Readonly<Record<ChallengeMetric, MetricResult | null>>;

// Spec 3 Scoring and review › Metrics
export const CATEGORY_METRIC: Readonly<Record<ChallengeCategory, ChallengeMetric>> = { 'card-values': 'card-values', 'running-count': 'running-count', conversion: 'true-count', table: 'running-count' };

export interface CountRange {
  readonly min: number;
  readonly max: number;
}

export interface RunningCountAid {
  readonly revealed: boolean;
  readonly count: number | null;
}

export type HiLoExplanation = { readonly kind: 'hi-lo-value'; readonly rank: Rank; readonly value: HiLoValue };

export type RunningCountExplanation = { readonly kind: 'running-count'; readonly rank: Rank; readonly value: HiLoValue; readonly before: number; readonly count: number };

// Spec 3 Learn, Check and assistance › Learn; Lessons › Content requirements; #134
export type ConversionExplanation = { readonly kind: 'conversion'; readonly running: number; readonly decks: number; readonly trueCount: number; readonly exact: boolean };

export type ChallengeExplanation = HiLoExplanation | RunningCountExplanation | ConversionExplanation | TableRunningExplanation;

export interface CardValueReview {
  readonly kind: 'card-value';
  readonly position: number;
  readonly card: ChallengeCard;
  readonly entered: ChallengeEntry;
  readonly reference: HiLoValue;
}

// Spec 3 Scoring and review › Review facts
export interface RunningCountReview {
  readonly kind: 'running-count';
  readonly checkpoint: number;
  readonly position: number;
  readonly entered: ChallengeEntry;
  readonly reference: number;
  readonly error: number | null;
}

// Spec 3 Scoring and review › Review facts
export interface ConversionReview {
  readonly kind: 'conversion';
  readonly position: number;
  readonly running: number;
  readonly decks: number;
  readonly entered: ChallengeEntry;
  readonly reference: number;
  readonly error: number | null;
}

// Spec 3 Scoring and review › Review facts (table); S3-09
export interface TableCountReview {
  readonly kind: 'table';
  readonly checkpoint: number;
  readonly round: number;
  readonly timing: CheckpointTiming;
  readonly count: TableCount;
  readonly position: number;
  readonly entered: ChallengeEntry;
  readonly reference: number;
  readonly error: number | null;
}

// Spec 3 Scoring and review › Review facts (per decision), Attribution; S3-09 VToCp; #138
export interface TableDecisionReview {
  readonly kind: 'table-decision';
  readonly round: number;
  readonly position: number;
  readonly decision: 'insurance' | 'hand';
  readonly hand: number;
  readonly hands: number;
  readonly cards: readonly ChallengeCard[];
  readonly total: HandTotal;
  readonly pair: boolean;
  readonly up: ChallengeCard;
  readonly trueCount: number;
  readonly countDependent: boolean;
  readonly prescribed: PlayChoice;
  readonly fallback: boolean;
  readonly chosen: PlayChoice;
  readonly refused: readonly PlayChoice[];
  readonly played: PlayChoice | null;
  readonly resolution: PlayDecision['resolution'];
  readonly entered: ChallengeEntry | null;
  readonly atEntered: PlayChoice | null;
}

export type ReviewFact = CardValueReview | RunningCountReview | ConversionReview | TableCountReview | TableDecisionReview;

export interface ChallengeResults {
  readonly ending: ChallengeEnding;
  readonly metrics: ChallengeMetrics;
  readonly review: readonly ReviewFact[];
  readonly assisted: boolean;
  readonly assistanceStep: number | null;
}

export interface LearnFeedback {
  readonly entered: ChallengeEntry;
  readonly correct: boolean;
  readonly reference: number;
  readonly scored: boolean;
  readonly explanation: ChallengeExplanation;
}

interface ChallengeViewBase {
  readonly attemptId: string;
  readonly category: ChallengeCategory;
  readonly phase: ChallengePhase;
  readonly sequence: number;
  readonly legalCommands: readonly ChallengeCommandKind[];
  readonly length: number;
  readonly position: number;
  readonly item: ChallengeItem | null;
  readonly choices: readonly HiLoValue[];
  readonly countRange: CountRange | null;
  readonly checkpoints: readonly number[] | null;
  // Spec 3 Learn, Check and assistance › Show/hide running count
  readonly countAid: RunningCountAid | null;
  // Spec 3 Screens › Exercise (table)
  readonly table: TableView | null;
  readonly assisted: boolean;
  readonly results: ChallengeResults | null;
}

export interface LearnChallengeView extends ChallengeViewBase {
  readonly variant: 'learn';
  readonly feedback: LearnFeedback | null;
  // Spec 3 Learn, Check and assistance › Learn (Play correction pause); S3-07 j4X6V; #138
  readonly correction: PlayCorrection | null;
}

// Spec 3 Learn, Check and assistance › Check
export interface CheckChallengeView extends ChallengeViewBase {
  readonly variant: 'check';
  readonly entered: ChallengeEntry | null;
}

export type ChallengeView = LearnChallengeView | CheckChallengeView;

export class ChallengeSpecificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChallengeSpecificationError';
  }
}

const SUITS: readonly Suit[] = ['clubs', 'diamonds', 'hearts', 'spades'];
const RANK_COUNT = 13;

export function contentProblem(content: unknown): string | undefined {
  if (!isRecord(content)) return 'a content definition is an object';
  if (content.category === 'running-count') return runningCountProblem(content);
  if (content.category === 'conversion') return conversionProblem(content);
  if (content.category === 'table') return tableContentProblem(content);
  if (!hasExactKeys(content, ['category', 'id', 'version', 'length', 'coverage'])) return 'a card-values content definition has a category, id, version, length and coverage';
  if (content.category !== 'card-values') return `unsupported challenge category ${String(content.category)}`;
  if (!isText(content.id) || !isCount(content.version) || content.version < 1) return 'the content definition needs an id and a version from 1';
  if (content.coverage !== 'every-rank') return `unsupported coverage ${String(content.coverage)}`;
  if (!isCount(content.length) || content.length < RANK_COUNT || content.length > 52) return `every rank needs a length from ${RANK_COUNT} to 52`;
  return undefined;
}

const MAX_DECKS = 8;

function runningCountProblem(content: Record<string, unknown>): string | undefined {
  if (!hasExactKeys(content, ['category', 'id', 'version', 'length', 'decks', 'checkpoints', 'reference'])) {
    return 'a running-count content definition has a category, id, version, length, decks, checkpoints and reference';
  }
  if (!isText(content.id) || !isCount(content.version) || content.version < 1) return 'the content definition needs an id and a version from 1';
  const { reference, decks, length, checkpoints } = content;
  if (!hasExactKeys(reference, ['id', 'version']) || !isText(reference.id) || !isCount(reference.version)) return 'running count needs a blackjack reference identity';
  if (!isCount(decks) || decks < 1 || decks > MAX_DECKS) return `a shoe has 1 to ${MAX_DECKS} decks`;
  if (!isCount(length) || length < 1 || length > decks * 52) return 'the length must fit in the shoe';
  if (!Array.isArray(checkpoints) || checkpoints.length === 0 || checkpoints.at(-1) !== length) return 'checkpoints must end at the last card';
  if (!checkpoints.every((card, index) => isCount(card) && card >= 1 && (index === 0 || card > (checkpoints[index - 1] as number)))) return 'checkpoints are increasing card positions';
  return undefined;
}

// Spec 3 Challenge content › Conversion
const MIN_CONVERSION_LENGTH = 4;
const MAX_CONVERSION_LENGTH = 40;

function conversionProblem(content: Record<string, unknown>): string | undefined {
  if (!hasExactKeys(content, ['category', 'id', 'version', 'length', 'maxRunningCount', 'maxDecks'])) {
    return 'a conversion content definition has a category, id, version, length, maxRunningCount and maxDecks';
  }
  if (!isText(content.id) || !isCount(content.version) || content.version < 1) return 'the content definition needs an id and a version from 1';
  const { length, maxRunningCount, maxDecks } = content;
  if (!isCount(length) || length < MIN_CONVERSION_LENGTH || length > MAX_CONVERSION_LENGTH) return `a conversion set has ${MIN_CONVERSION_LENGTH} to ${MAX_CONVERSION_LENGTH} questions`;
  if (!isCount(maxRunningCount) || maxRunningCount < 1 || maxRunningCount > MAX_DECKS * 52) return `the largest running count is a whole number from 1 to ${MAX_DECKS * 52}`;
  if (!isCount(maxDecks) || maxDecks < 2 || maxDecks > MAX_DECKS) return `decks remaining go up to a whole number from 2 to ${MAX_DECKS}`;
  return undefined;
}

export function createChallenge(spec: ChallengeSpecification, random: RandomStreamIdentity): ChallengeState {
  const fail = (message: string): never => {
    throw new ChallengeSpecificationError(message);
  };
  const table = isRecord(spec) && isRecord(spec.content) && spec.content.category === 'table';
  if (!hasExactKeys(spec, ['attemptId', 'owner', 'device', 'variant', 'content', ...(table ? ['table'] : [])])) {
    fail(`the specification has an attempt id, owner, device, variant and content${table ? ' and a table setup' : ''}`);
  }
  if (!isText(spec.attemptId) || !isText(spec.owner) || !isText(spec.device)) fail('attempt id, owner and device are required');
  if (!CHALLENGE_VARIANTS.includes(spec.variant)) fail(`unknown variant ${String(spec.variant)}`);
  const problem = contentProblem(spec.content) ?? (table ? tableSetupProblem(spec.table) : undefined);
  if (problem) fail(problem);
  let stream: RandomStream;
  try {
    stream = RandomStream.create(random);
  } catch (error) {
    return fail(`invalid random stream identity: ${error instanceof Error ? error.message : String(error)}`);
  }
  const position = stream.state();
  const { content } = spec;
  return {
    schema: STATE_SCHEMA_VERSION,
    attempt: { id: spec.attemptId, owner: spec.owner, device: spec.device },
    identities: {
      engine: ENGINE_VERSION,
      category: content.category,
      content: { id: content.id, version: content.version },
      reference: content.category === 'running-count' || content.category === 'table' ? { id: content.reference.id, version: content.reference.version } : null,
      random: { protocol: position.protocol, key: position.key, session: position.session },
    },
    variant: spec.variant,
    content: copyContent(content),
    sequence: 0,
    phase: 'ready',
    ending: null,
    position: 0,
    items: [],
    rejected: 0,
    answers: [],
    revealedAt: null,
    table: spec.table ? { setup: copyTableSetup(spec.table), shoe: null, round: 0, seat: spec.table.seat === 'play' ? playSeat(spec.table, content as TableContent, spec, random) : null } : null,
    random: position,
    receipts: [],
  };
}

function playSeat(setup: PlaySetup, content: TableContent, spec: ChallengeSpecification, random: RandomStreamIdentity) {
  try {
    return openPlaySeat(copyTableSetup(setup) as PlaySetup, content, { id: spec.attemptId, owner: spec.owner, device: spec.device }, random);
  } catch (error) {
    throw new ChallengeSpecificationError(`your seat can't be opened: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function copyContent(content: ChallengeContent): ChallengeContent {
  if (content.category === 'running-count') return { ...content, checkpoints: [...content.checkpoints], reference: { ...content.reference } };
  return content.category === 'table' ? { ...content, reference: { ...content.reference } } : { ...content };
}

// Spec 3 Challenge content › Conversion
const halfDecks = (item: ConversionItem) => Math.round(item.decks * 2);
const isExact = (item: ConversionItem) => (2 * item.running) % halfDecks(item) === 0;

function coversConversion(items: readonly ConversionItem[]): boolean {
  const has = (test: (item: ConversionItem) => boolean) => items.some(test);
  return (
    has((item) => item.running === 0) &&
    has((item) => item.running !== 0 && isExact(item)) &&
    has((item) => item.running > 0 && !isExact(item)) &&
    has((item) => item.running < 0 && !isExact(item))
  );
}

// Spec 3 Challenge content › Generation
function generate(content: Exclude<ChallengeContent, TableContent>, stream: RandomStream): { items: ChallengeItem[]; rejected: number } {
  if (content.category === 'conversion') {
    for (let rejected = 0; ; rejected++) {
      const items = Array.from({ length: content.length }, (): ConversionItem => {
        const running = uniformInt(stream, 2 * content.maxRunningCount + 1) - content.maxRunningCount;
        return { running, decks: (uniformInt(stream, 2 * content.maxDecks) + 1) / 2 };
      });
      if (coversConversion(items)) return { items, rejected };
    }
  }
  if (content.category === 'running-count') {
    const exposed = shuffle(stream, canonicalShoe(content.decks)).slice(0, content.length);
    return { items: exposed.map(({ rank, suit }) => ({ card: { rank, suit } })), rejected: 0 };
  }
  for (let rejected = 0; ; rejected++) {
    const items = Array.from({ length: content.length }, (): CardValueItem => {
      const index = uniformInt(stream, SUITS.length * RANK_COUNT);
      return { card: { suit: SUITS[Math.floor(index / RANK_COUNT)] as Suit, rank: ((index % RANK_COUNT) + 1) as Rank } };
    });
    if (new Set(items.map((item) => item.card.rank)).size === RANK_COUNT) return { items, rejected };
  }
}

const hiLo = (item: ChallengeItem): HiLoValue => hiLoTag({ deck: 0, ...(item as CardValueItem).card }) as HiLoValue;

// Spec 3 Scoring and review › Reference
const countThrough = (state: ChallengeState, position: number) => state.items.slice(0, position + 1).reduce((count, item) => count + hiLo(item), 0);

// Spec 3 Challenge content › Conversion
export const conversionTrueCount = (item: ConversionItem): number => truncatedTrueCount(item.running, halfDecks(item));

const tableSteps = (state: ChallengeState) => state.items as readonly TableStep[];

function reference(state: ChallengeState, position: number): number {
  const item = state.items[position] as ChallengeItem;
  if (state.content.category === 'table') {
    const count = tableCountAt(tableSteps(state), position);
    return (item as TableStep).step === 'prompt' && (item as Extract<TableStep, { step: 'prompt' }>).count === 'true' ? count.trueCount : count.running;
  }
  if (state.content.category === 'running-count') return countThrough(state, position);
  return state.content.category === 'conversion' ? conversionTrueCount(item as ConversionItem) : hiLo(item);
}

const isCorrect = (state: ChallengeState, position: number, entry: ChallengeEntry) => entry !== 'skip' && entry === reference(state, position);

function asks(state: ChallengeState, position: number): boolean {
  if (state.content.category === 'table') return (state.items[position] as TableStep).step === 'prompt';
  return state.content.category !== 'running-count' || state.variant === 'learn' || state.content.checkpoints.includes(position + 1);
}

const counting = (state: ChallengeState) => state.content.category === 'running-count' || state.content.category === 'table';

// Spec 3 Audio and haptics; Count checkpoints (table); Challenge content › Reshuffle
function shownFacts(state: ChallengeState, position: number): ChallengeFact[] {
  if (state.content.category !== 'table') {
    const checkpoint = state.content.category === 'running-count' && state.variant === 'check' && asks(state, position);
    return [{ kind: 'content-shown', position }, ...(checkpoint ? [{ kind: 'checkpoint-due', position } as const] : [])];
  }
  const step = state.items[position] as TableStep;
  if (step.step === 'shuffle') return [{ kind: 'shoe-shuffled', position }];
  if (step.step === 'prompt') return step.count === 'running' || step.timing === 'decision' ? [{ kind: 'checkpoint-due', position }] : [];
  if (step.step === 'decision') return [];
  return [{ kind: 'content-shown', position }];
}

function showingPhase(state: ChallengeState, position: number): ChallengePhase {
  if (asks(state, position)) return 'question';
  return state.content.category === 'table' && (state.items[position] as TableStep).step === 'decision' ? 'decision' : 'card';
}

const currentAnswers = (state: ChallengeState): ItemAnswers | undefined => {
  const last = state.answers.at(-1);
  return last?.position === state.position ? last : undefined;
};

const LEGAL: Record<ChallengePhase, readonly ChallengeCommandKind[]> = {
  ready: ['begin', 'end'],
  card: ['next-item', 'end'],
  question: ['answer', 'skip', 'end'],
  explanation: ['retry-item', 'next-item', 'end'],
  recorded: ['next-item', 'end'],
  decision: ['play', 'end'],
  correction: ['retry-correction', 'override-correction', 'end'],
  ended: [],
};

const SHOWING: readonly ChallengePhase[] = ['card', 'question', 'explanation', 'recorded', 'decision', 'correction'];

const canReveal = (state: ChallengeState) => counting(state) && state.revealedAt === null && SHOWING.includes(state.phase);

function legalCommands(state: ChallengeState): readonly ChallengeCommandKind[] {
  let legal = LEGAL[state.phase];
  if (state.phase === 'explanation' && isCorrect(state, state.position, (currentAnswers(state) as ItemAnswers).last)) legal = ['next-item', 'end'];
  return canReveal(state) ? [...legal.filter((kind) => kind !== 'end'), 'reveal-count', 'end'] : legal;
}

const promptCount = (state: ChallengeState): TableCount => {
  const step = state.items[state.position] as TableStep | undefined;
  return step?.step === 'prompt' ? step.count : 'running';
};

// Spec 3 Learn, Check and assistance › Malformed input
function countRange(state: ChallengeState): CountRange | null {
  const { content } = state;
  if (content.category === 'card-values') return null;
  if (content.category === 'table') return tableCountRange(promptCount(state));
  const limit = content.category === 'conversion' ? 2 * content.maxRunningCount : content.length;
  return { min: -limit, max: limit };
}

function answerProblem(state: ChallengeState, value: number): string | undefined {
  const range = countRange(state);
  if (!range) return HI_LO_VALUES.includes(value as HiLoValue) ? undefined : 'a card value is +1, 0 or −1';
  const what = state.content.category === 'conversion' || (state.content.category === 'table' && promptCount(state) === 'true') ? 'a true count' : 'a running count';
  return value >= range.min && value <= range.max ? undefined : `${what} is a whole number from −${range.max} to +${range.max}`;
}

const PLAY_CHOICES: readonly PlayChoice[] = ['hit', 'stand', 'double', 'split', 'surrender', 'insure', 'decline-insurance'];

function isCommand(value: unknown): value is ChallengeCommand {
  if (!isRecord(value)) return false;
  switch (value.kind) {
    case 'answer':
      return hasExactKeys(value, ['kind', 'value']) && Number.isSafeInteger(value.value);
    case 'play':
      return hasExactKeys(value, ['kind', 'action']) && PLAY_CHOICES.includes(value.action as PlayChoice);
    case 'begin':
    case 'reveal-count':
    case 'retry-correction':
    case 'override-correction':
    case 'skip':
    case 'retry-item':
    case 'next-item':
    case 'end':
      return hasExactKeys(value, ['kind']);
    default:
      return false;
  }
}

const reject = (reason: RejectionReason, message: string) => ({ status: 'rejected', reason, message }) as const;

export function advanceChallenge(state: ChallengeState, envelope: ChallengeEnvelope): ChallengeAdvance {
  if (!hasExactKeys(envelope, ['sequence', 'commandId', 'command']) || !isCount(envelope.sequence) || !isText(envelope.commandId)) {
    return reject('malformed', 'an envelope needs a sequence, a command id and a command');
  }
  if (!isCommand(envelope.command)) return reject('malformed', 'unknown command or malformed command fields');
  const commandText = canonicalJson(envelope.command);
  const prior = state.receipts.find((receipt) => receipt.commandId === envelope.commandId);
  if (prior) {
    return prior.command === commandText && prior.sequence === envelope.sequence
      ? { status: 'duplicate', receipt: prior }
      : reject('conflicting-command-id', `command id ${envelope.commandId} was already used for a different command`);
  }
  if (envelope.sequence !== state.sequence) return reject('stale', `expected sequence ${state.sequence}, got ${envelope.sequence}`);
  const command = envelope.command;
  if (!legalCommands(state).includes(command.kind)) return reject('not-legal-in-phase', `${command.kind} is not legal in ${state.phase}`);
  if (command.kind === 'answer') {
    const problem = answerProblem(state, command.value);
    if (problem) return reject('malformed', problem);
  }
  const { change, facts } = apply(state, command);
  const receipt: Receipt = { commandId: envelope.commandId, sequence: state.sequence, command: commandText, disposition: 'applied' };
  return { status: 'committed', state: { ...state, ...change, sequence: state.sequence + 1, receipts: [...state.receipts, receipt] }, facts, receipt };
}

type Change = Partial<Pick<ChallengeState, 'phase' | 'ending' | 'position' | 'items' | 'rejected' | 'answers' | 'revealedAt' | 'table' | 'random'>>;

// Spec 3 Challenge content › Table, Reshuffle
function dealNextRound(state: ChallengeState): Change {
  const table = state.table as TableProgress;
  const dealt = dealTableRound(table, state.content as TableContent, tableSteps(state), state.random);
  return { items: [...state.items, ...dealt.steps], table: dealt.progress, random: dealt.random };
}

function show(state: ChallengeState, change: Change, position: number): { change: Change; facts: ChallengeFact[] } {
  const next = { ...state, ...change };
  return { change: { ...change, phase: showingPhase(next, position), position }, facts: shownFacts(next, position) };
}

function apply(state: ChallengeState, command: ChallengeCommand): { change: Change; facts: ChallengeFact[] } {
  switch (command.kind) {
    case 'begin': {
      if (state.content.category === 'table') return show(state, dealNextRound(state), 0);
      const stream = RandomStream.restore(state.random);
      const { items, rejected } = generate(state.content, stream);
      return show(state, { items, rejected, random: stream.state() }, 0);
    }
    case 'answer':
    case 'skip': {
      const entry: ChallengeEntry = command.kind === 'skip' ? 'skip' : command.value;
      const earlier = currentAnswers(state);
      const answered: ItemAnswers = earlier ? { ...earlier, last: entry, tries: earlier.tries + 1 } : { position: state.position, first: entry, last: entry, tries: 1 };
      const answers = [...(earlier ? state.answers.slice(0, -1) : state.answers), answered];
      return { change: { phase: state.variant === 'check' ? 'recorded' : 'explanation', answers }, facts: [{ kind: 'answer-accepted', position: state.position, scored: !earlier }] };
    }
    case 'retry-item':
      return { change: { phase: 'question' }, facts: [] };
    case 'next-item': {
      const position = state.position + 1;
      const more = state.content.category === 'table' && position === state.items.length && (state.table as TableProgress).round < state.content.rounds;
      const change = more ? dealNextRound(state) : {};
      if (position < (change.items ?? state.items).length) return show(state, change, position);
      return { change: { phase: 'ended', ending: 'completed', position }, facts: [{ kind: 'attempt-ended', ending: 'completed' }] };
    }
    case 'reveal-count':
      return { change: { revealedAt: state.position + 1 }, facts: [] };
    case 'play':
      return play(state, command.action);
    case 'retry-correction':
    case 'override-correction': {
      const correction = (state.table as TableProgress).seat?.correction as PlayCorrection;
      const move = command.kind === 'retry-correction' ? correction.explanation.prescribed.action : correction.actual.action;
      return played(state, move, command.kind === 'retry-correction' ? 'retried' : 'overridden');
    }
    case 'end':
      return { change: { phase: 'ended', ending: 'abandoned' }, facts: [{ kind: 'attempt-ended', ending: 'abandoned' }] };
  }
}

// Spec 3 User stories 37, 38; Scoring and review › Attribution; #138
function play(state: ChallengeState, action: PlayChoice): { change: Change; facts: ChallengeFact[] } {
  const table = state.table as TableProgress;
  const seat = table.seat as NonNullable<TableProgress['seat']>;
  const decision = currentDecision(seat);
  const legal = (state.items[state.position] as Extract<TableStep, { step: 'decision' }>).actions.includes(action);
  const tried: PlayDecision = { ...decision, attempts: [...decision.attempts, { action, legal }] };
  const withAttempt = { ...table, seat: { ...seat, decisions: [...seat.decisions.slice(0, -1), tried] } };
  if (!legal) return { change: { table: withAttempt }, facts: [{ kind: 'move-refused', position: state.position, action }] };
  const prescribed = decision.explanation.prescribed.action;
  if (state.variant === 'learn' && action !== prescribed) {
    const correction: PlayCorrection = {
      id: `${state.attempt.id}/departure/${state.sequence}`,
      turn: table.round,
      decision: seat.decisions.length - 1,
      explanation: decision.explanation,
      actual: { action, amount: null },
    };
    return { change: { phase: 'correction', table: { ...withAttempt, seat: { ...withAttempt.seat, correction } } }, facts: [{ kind: 'correction-offered', position: state.position }] };
  }
  return played({ ...state, table: withAttempt }, action, action === prescribed ? 'followed' : 'departed');
}

function played(state: ChallengeState, move: PlayChoice, resolution: NonNullable<PlayDecision['resolution']>): { change: Change; facts: ChallengeFact[] } {
  const next = playMove(state.table as TableProgress, state.content as TableContent, tableSteps(state), move, resolution);
  return show(state, { table: { ...next.progress }, items: [...state.items, ...next.steps] }, state.position + 1);
}

// Spec 3 Attempt lifecycle › Performance timer; #135, #137
export const challengeLength = (state: ChallengeState): number => (state.content.category === 'table' ? state.content.rounds : state.content.length);

export function challengeReached(state: ChallengeState): number {
  if (state.content.category === 'table') return (state.table as TableProgress).round;
  return Math.min(state.position + 1, state.content.length);
}

export function lastAnswerGiven(state: ChallengeState): boolean {
  if (state.phase === 'ended') return true;
  if (state.phase !== 'recorded' && state.phase !== 'explanation') return false;
  const atLastItem = state.content.category === 'table' ? state.position + 1 >= state.items.length && challengeReached(state) >= state.content.rounds : state.position + 1 >= state.content.length;
  return atLastItem;
}

// Spec 3 Scoring and review
export function challengeResults(state: ChallengeState): ChallengeResults | null {
  if (state.phase !== 'ended' || state.ending === null) return null;
  const review: ReviewFact[] = state.answers.map((answers, index): ReviewFact => {
    const entered = answers.first;
    const correct = reference(state, answers.position);
    const error = entered === 'skip' ? null : entered - correct;
    if (state.content.category === 'running-count') return { kind: 'running-count', checkpoint: index + 1, position: answers.position + 1, entered, reference: correct, error };
    if (state.content.category === 'table') {
      const prompt = state.items[answers.position] as Extract<TableStep, { step: 'prompt' }>;
      return { kind: 'table', checkpoint: prompt.checkpoint, round: prompt.round, timing: prompt.timing, count: prompt.count, position: answers.position + 1, entered, reference: correct, error };
    }
    if (state.content.category === 'conversion') {
      const { running, decks } = state.items[answers.position] as ConversionItem;
      return { kind: 'conversion', position: answers.position + 1, running, decks, entered, reference: correct, error };
    }
    const item = state.items[answers.position] as CardValueItem;
    return { kind: 'card-value', position: answers.position + 1, card: item.card, entered, reference: correct as HiLoValue };
  });
  const metrics = Object.fromEntries(CHALLENGE_METRICS.map((metric) => [metric, null])) as Record<ChallengeMetric, MetricResult | null>;
  const score = <F extends ReviewFact>(facts: readonly F[], right: (fact: F) => boolean): MetricResult | null => (facts.length === 0 ? null : { correct: facts.filter(right).length, total: facts.length });
  const counted = (fact: Exclude<ReviewFact, TableDecisionReview>) => fact.entered === fact.reference;
  const counts = review as Exclude<ReviewFact, TableDecisionReview>[];
  if (state.content.category === 'table') {
    metrics['running-count'] = score(counts.filter((fact) => fact.kind === 'table' && fact.count === 'running'), counted);
    metrics['true-count'] = score(counts.filter((fact) => fact.kind === 'table' && fact.count === 'true'), counted);
    const decisions = decisionReviews(state);
    if (state.table?.setup.seat === 'play') metrics['playing-adherence'] = score(decisions, (fact) => fact.chosen === fact.prescribed);
    review.push(...decisions);
    review.sort((a, b) => a.position - b.position);
  } else metrics[CATEGORY_METRIC[state.content.category]] = score(counts, counted);
  return { ending: state.ending, metrics, review, assisted: assisted(state), assistanceStep: state.revealedAt };
}


// Spec 3 Scoring and review › Reference, Attribution; #138
function decisionReviews(state: ChallengeState): TableDecisionReview[] {
  const table = state.table as TableProgress;
  if (table.seat === null) return [];
  const setup = table.setup as PlaySetup;
  return table.seat.decisions.flatMap((decision): TableDecisionReview[] => {
    const [first] = decision.attempts;
    if (!first) return [];
    const { situation, prescribed } = decision.explanation;
    const prompt = decision.prompt === null ? undefined : state.answers.find((answers) => answers.position === decision.prompt);
    const entered = prompt ? prompt.first : null;
    return [
      {
        kind: 'table-decision',
        round: (state.items[decision.position] as TableStep).round,
        position: decision.position + 1,
        decision: situation.decision,
        hand: situation.hand,
        hands: situation.hands,
        cards: situation.cards.map(cardOf),
        total: { ...situation.total },
        pair: situation.pair,
        up: cardOf(situation.up),
        trueCount: tableCountAt(tableSteps(state), decision.position).trueCount,
        countDependent: decision.explanation.deviation !== null,
        prescribed: prescribed.action,
        fallback: decision.explanation.unavailable.length > 0,
        chosen: first.action,
        refused: decision.attempts.flatMap((attempt) => (attempt.legal ? [] : [attempt.action])),
        played: decision.played,
        resolution: decision.resolution,
        entered,
        atEntered: typeof entered === 'number' ? policyAt(setup, decision, entered) : null,
      },
    ];
  });
}


function policyAt(setup: PlaySetup, decision: PlayDecision, trueCount: number): PlayChoice {
  const { situation } = decision.explanation;
  const rules = { dealer: setup.rules.dealer, lateSurrender: setup.rules.lateSurrender };
  const { decision: kind, cards, hands, up, available, stake } = situation;
  return prescribeAtTrueCount(setup.policy, { game: 'blackjack', rules, decision: kind, cards, hands, up, balance: available, stake }, trueCount).prescribed.action;
}

// Spec 3 Scoring and review › Attribution; S3-09 h0MsKr
export function runningCountDrift(review: readonly ReviewFact[]): { readonly from: number; readonly error: number } | null {
  const answered = review.filter((fact): fact is RunningCountReview & { error: number } => fact.kind === 'running-count' && fact.error !== null);
  const last = answered.at(-1);
  if (!last || last.error === 0) return null;
  let start = answered.length - 1;
  while (start > 0 && (answered[start - 1] as RunningCountReview).error === last.error) start--;
  return answered.length - start >= 2 ? { from: (answered[start] as RunningCountReview).checkpoint, error: last.error } : null;
}

// Spec 3 Learn, Check and assistance
const assisted = (state: ChallengeState) => state.variant === 'learn' || state.revealedAt !== null;

// Spec 3 Challenge content › Conversion
export const conversionExplanation = (item: ConversionItem): ConversionExplanation => ({
  kind: 'conversion',
  running: item.running,
  decks: item.decks,
  trueCount: conversionTrueCount(item),
  exact: isExact(item),
});

function explain(state: ChallengeState, item: ChallengeItem): ChallengeExplanation {
  if (state.content.category === 'conversion') return conversionExplanation(item as ConversionItem);
  if (state.content.category === 'table') {
    if ((item as Extract<TableStep, { step: 'prompt' }>).count === 'running') return tableRunningExplanation(tableSteps(state), state.position);
    const { running, decks } = tableCountAt(tableSteps(state), state.position);
    return conversionExplanation({ running, decks });
  }
  const { rank } = (item as CardValueItem).card;
  if (state.content.category === 'card-values') return { kind: 'hi-lo-value', rank, value: hiLo(item) };
  const count = countThrough(state, state.position);
  return { kind: 'running-count', rank, value: hiLo(item), before: count - hiLo(item), count };
}

const copyItem = (item: ChallengeItem): ChallengeItem => ('card' in item ? { card: { ...item.card } } : (JSON.parse(JSON.stringify(item)) as ChallengeItem));

// Spec 3 Learn, Check and assistance › Show/hide running count
function revealedCount(state: ChallengeState): number {
  if (state.content.category === 'table') return tableCountAt(tableSteps(state), state.position).running;
  return countThrough(state, state.position);
}

export function readChallengeView(state: ChallengeState): ChallengeView {
  const shown = SHOWING.includes(state.phase);
  const item = shown ? (state.items[state.position] as ChallengeItem) : null;
  const answered = state.phase === 'explanation' || state.phase === 'recorded' ? (currentAnswers(state) as ItemAnswers) : null;
  const table = state.content.category === 'table' ? state.content : null;
  const base: ChallengeViewBase = {
    attemptId: state.attempt.id,
    category: state.identities.category,
    phase: state.phase,
    sequence: state.sequence,
    legalCommands: [...legalCommands(state)],
    length: table ? table.rounds : (state.content as Exclude<ChallengeContent, TableContent>).length,
    position: item ? state.position + 1 : 0,
    item: item && copyItem(item),
    choices: item && state.content.category === 'card-values' ? HI_LO_VALUES : [],
    countRange: countRange(state),
    checkpoints: state.content.category === 'running-count' && state.variant === 'check' ? [...state.content.checkpoints] : null,
    countAid: counting(state) ? { revealed: state.revealedAt !== null, count: item && state.revealedAt !== null ? revealedCount(state) : null } : null,
    table: table && item ? tableView(state.table as TableProgress, table, tableSteps(state), state.position) : null,
    assisted: assisted(state),
    results: challengeResults(state),
  };
  if (state.variant === 'check') return { ...base, variant: 'check', entered: answered && answered.last };
  return {
    ...base,
    variant: 'learn',
    feedback:
      item && answered
        ? {
            entered: answered.last,
            correct: isCorrect(state, state.position, answered.last),
            reference: reference(state, state.position),
            scored: answered.tries === 1,
            explanation: explain(state, item),
          }
        : null,
    correction: state.phase === 'correction' ? (state.table?.seat?.correction ?? null) : null,
  };
}

export const encodeChallengeCheckpoint = (state: ChallengeState): string => canonicalJson(state);

export const challengeCheckpointHash = (state: ChallengeState): string => sha256Hex(encodeChallengeCheckpoint(state));

export type ChallengeCheckpointResult =
  | { readonly ok: true; readonly state: ChallengeState }
  | { readonly ok: false; readonly error: { readonly kind: 'damaged' | 'unsupported'; readonly message: string } };

// Spec 3 Attempt lifecycle › Durability
export function decodeChallengeCheckpoint(text: string): ChallengeCheckpointResult {
  const damaged = (message: string) => ({ ok: false, error: { kind: 'damaged', message } }) as const;
  const unsupported = (message: string) => ({ ok: false, error: { kind: 'unsupported', message } }) as const;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return damaged('the checkpoint is not JSON');
  }
  if (!isRecord(value) || !isRecord(value.identities)) return damaged('damaged identities');
  const { identities } = value;
  if (typeof value.schema === 'number' && value.schema !== STATE_SCHEMA_VERSION) return unsupported(`unsupported state schema ${value.schema}`);
  if (typeof identities.engine === 'string' && identities.engine !== ENGINE_VERSION) return unsupported(`unsupported engine ${identities.engine}`);
  if (typeof identities.category === 'string' && !CHALLENGE_CATEGORIES.includes(identities.category as ChallengeCategory)) {
    return unsupported(`unsupported challenge category ${identities.category}`);
  }
  const random = identities.random;
  if (isRecord(random) && typeof random.protocol === 'number' && random.protocol !== RANDOM_PROTOCOL_VERSION) {
    return unsupported(`unsupported random protocol ${random.protocol}`);
  }
  const attempt = value.attempt;
  if (!isRecord(attempt) || !Array.isArray(value.receipts)) return damaged('damaged attempt');
  let state: ChallengeState;
  try {
    state = createChallenge(
      {
        attemptId: attempt.id,
        owner: attempt.owner,
        device: attempt.device,
        variant: value.variant,
        content: value.content,
        ...(isRecord(value.table) ? { table: value.table.setup } : {}),
      } as ChallengeSpecification,
      random as RandomStreamIdentity,
    );
    for (const receipt of value.receipts as unknown[]) {
      if (!hasExactKeys(receipt, ['commandId', 'sequence', 'command', 'disposition']) || typeof receipt.command !== 'string') return damaged('damaged receipt');
      const result = advanceChallenge(state, { sequence: receipt.sequence, commandId: receipt.commandId, command: JSON.parse(receipt.command) } as ChallengeEnvelope);
      if (result.status !== 'committed') return damaged('damaged receipt');
      state = result.state;
    }
  } catch {
    return damaged('the checkpoint does not replay');
  }
  return encodeChallengeCheckpoint(state) === text ? { ok: true, state } : damaged('the checkpoint does not match its replay');
}
