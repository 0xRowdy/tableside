// Spec 3 Modules › Engine; Challenge content; Learn, Check and assistance; #158, #132, #133, #134

import { STATE_SCHEMA_VERSION, type Receipt, type RejectionReason, type VersionedIdentity } from './activity';
import { hiLoTag, truncatedTrueCount } from './blackjack';
import { canonicalJson } from './canonical';
import { canonicalShoe, shuffle, type Rank, type Suit } from './draws';
import { RANDOM_PROTOCOL_VERSION, RandomStream, uniformInt, type RandomStreamIdentity, type RandomStreamState } from './random';
import { sha256Hex } from './sha256';
import { hasExactKeys, isCount, isRecord, isText } from './shape';
import { ENGINE_VERSION } from './version';

export type ChallengeCategory = 'card-values' | 'running-count' | 'conversion';

export const CHALLENGE_CATEGORIES: readonly ChallengeCategory[] = ['card-values', 'running-count', 'conversion'];

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

export type ChallengeContent = CardValuesContent | RunningCountContent | ConversionContent;

export interface ChallengeSpecification {
  readonly attemptId: string;
  readonly owner: string;
  readonly device: string;
  readonly variant: ChallengeVariant;
  readonly content: ChallengeContent;
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

export type ChallengeItem = CardValueItem | ConversionItem;

export type ChallengeEntry = number | 'skip';

export interface ItemAnswers {
  readonly position: number;
  readonly first: ChallengeEntry;
  readonly last: ChallengeEntry;
  readonly tries: number;
}

// Spec 3 Challenge content › Running count
export type ChallengePhase = 'ready' | 'card' | 'question' | 'explanation' | 'recorded' | 'ended';

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
  | { readonly kind: 'end' };

export type ChallengeCommandKind = ChallengeCommand['kind'];

export interface ChallengeEnvelope {
  readonly sequence: number;
  readonly commandId: string;
  readonly command: ChallengeCommand;
}

export type ChallengeFact =
  | { readonly kind: 'content-shown'; readonly position: number }
  | { readonly kind: 'answer-accepted'; readonly position: number; readonly scored: boolean }
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

// Spec 3 Scoring and review › Metrics: the one metric each category tests
export const CATEGORY_METRIC: Readonly<Record<ChallengeCategory, ChallengeMetric>> = { 'card-values': 'card-values', 'running-count': 'running-count', conversion: 'true-count' };

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

export type ChallengeExplanation = HiLoExplanation | RunningCountExplanation | ConversionExplanation;

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

export type ReviewFact = CardValueReview | RunningCountReview | ConversionReview;

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
  readonly assisted: boolean;
  readonly results: ChallengeResults | null;
}

export interface LearnChallengeView extends ChallengeViewBase {
  readonly variant: 'learn';
  readonly feedback: LearnFeedback | null;
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
  if (!isCount(maxRunningCount) || maxRunningCount < 1 || maxRunningCount > MAX_DECKS * 52) return 'the largest running count is a whole number from 1';
  if (!isCount(maxDecks) || maxDecks < 2 || maxDecks > MAX_DECKS) return `decks remaining go up to a whole number from 2 to ${MAX_DECKS}`;
  return undefined;
}

export function createChallenge(spec: ChallengeSpecification, random: RandomStreamIdentity): ChallengeState {
  const fail = (message: string): never => {
    throw new ChallengeSpecificationError(message);
  };
  if (!hasExactKeys(spec, ['attemptId', 'owner', 'device', 'variant', 'content'])) fail('the specification has an attempt id, owner, device, variant and content');
  if (!isText(spec.attemptId) || !isText(spec.owner) || !isText(spec.device)) fail('attempt id, owner and device are required');
  if (!CHALLENGE_VARIANTS.includes(spec.variant)) fail(`unknown variant ${String(spec.variant)}`);
  const problem = contentProblem(spec.content);
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
      reference: content.category === 'running-count' ? { id: content.reference.id, version: content.reference.version } : null,
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
    random: position,
    receipts: [],
  };
}

const copyContent = (content: ChallengeContent): ChallengeContent =>
  content.category === 'running-count' ? { ...content, checkpoints: [...content.checkpoints], reference: { ...content.reference } } : { ...content };

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
function generate(content: ChallengeContent, stream: RandomStream): { items: ChallengeItem[]; rejected: number } {
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

function reference(state: ChallengeState, position: number): number {
  const item = state.items[position] as ChallengeItem;
  if (state.content.category === 'running-count') return countThrough(state, position);
  return state.content.category === 'conversion' ? conversionTrueCount(item as ConversionItem) : hiLo(item);
}

const isCorrect = (state: ChallengeState, position: number, entry: ChallengeEntry) => entry !== 'skip' && entry === reference(state, position);

const asks = (state: ChallengeState, position: number) =>
  state.content.category !== 'running-count' || state.variant === 'learn' || state.content.checkpoints.includes(position + 1);

const showingPhase = (state: ChallengeState, position: number): ChallengePhase => (asks(state, position) ? 'question' : 'card');

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
  ended: [],
};

const SHOWING: readonly ChallengePhase[] = ['card', 'question', 'explanation', 'recorded'];

const canReveal = (state: ChallengeState) => state.content.category === 'running-count' && state.revealedAt === null && SHOWING.includes(state.phase);

function legalCommands(state: ChallengeState): readonly ChallengeCommandKind[] {
  let legal = LEGAL[state.phase];
  if (state.phase === 'explanation' && isCorrect(state, state.position, (currentAnswers(state) as ItemAnswers).last)) legal = ['next-item', 'end'];
  return canReveal(state) ? [...legal.filter((kind) => kind !== 'end'), 'reveal-count', 'end'] : legal;
}

// Spec 3 Learn, Check and assistance › Malformed input: the widest answer the content allows
function countRange(content: ChallengeContent): CountRange | null {
  if (content.category === 'card-values') return null;
  const limit = content.category === 'conversion' ? 2 * content.maxRunningCount : content.length;
  return { min: -limit, max: limit };
}

function answerProblem(state: ChallengeState, value: number): string | undefined {
  const range = countRange(state.content);
  if (!range) return HI_LO_VALUES.includes(value as HiLoValue) ? undefined : 'a card value is +1, 0 or −1';
  const what = state.content.category === 'conversion' ? 'a true count' : 'a running count';
  return value >= range.min && value <= range.max ? undefined : `${what} is a whole number from ${range.min} to +${range.max}`;
}

function isCommand(value: unknown): value is ChallengeCommand {
  if (!isRecord(value)) return false;
  switch (value.kind) {
    case 'answer':
      return hasExactKeys(value, ['kind', 'value']) && Number.isSafeInteger(value.value);
    case 'begin':
    case 'reveal-count':
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

type Change = Partial<Pick<ChallengeState, 'phase' | 'ending' | 'position' | 'items' | 'rejected' | 'answers' | 'revealedAt' | 'random'>>;

function apply(state: ChallengeState, command: ChallengeCommand): { change: Change; facts: ChallengeFact[] } {
  switch (command.kind) {
    case 'begin': {
      const stream = RandomStream.restore(state.random);
      const { items, rejected } = generate(state.content, stream);
      return { change: { phase: showingPhase(state, 0), items, rejected, random: stream.state() }, facts: [{ kind: 'content-shown', position: 0 }] };
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
      if (position < state.items.length) return { change: { phase: showingPhase(state, position), position }, facts: [{ kind: 'content-shown', position }] };
      return { change: { phase: 'ended', ending: 'completed', position }, facts: [{ kind: 'attempt-ended', ending: 'completed' }] };
    }
    case 'reveal-count':
      return { change: { revealedAt: state.position + 1 }, facts: [] };
    case 'end':
      return { change: { phase: 'ended', ending: 'abandoned' }, facts: [{ kind: 'attempt-ended', ending: 'abandoned' }] };
  }
}

// Spec 3 Scoring and review
export function challengeResults(state: ChallengeState): ChallengeResults | null {
  if (state.phase !== 'ended' || state.ending === null) return null;
  const review: ReviewFact[] = state.answers.map((answers, index): ReviewFact => {
    const entered = answers.first;
    const correct = reference(state, answers.position);
    const error = entered === 'skip' ? null : entered - correct;
    if (state.content.category === 'running-count') return { kind: 'running-count', checkpoint: index + 1, position: answers.position + 1, entered, reference: correct, error };
    if (state.content.category === 'conversion') {
      const { running, decks } = state.items[answers.position] as ConversionItem;
      return { kind: 'conversion', position: answers.position + 1, running, decks, entered, reference: correct, error };
    }
    const item = state.items[answers.position] as CardValueItem;
    return { kind: 'card-value', position: answers.position + 1, card: item.card, entered, reference: correct as HiLoValue };
  });
  const metrics = Object.fromEntries(CHALLENGE_METRICS.map((metric) => [metric, null])) as Record<ChallengeMetric, MetricResult | null>;
  metrics[CATEGORY_METRIC[state.content.category]] = review.length === 0 ? null : { correct: review.filter((fact) => fact.entered === fact.reference).length, total: review.length };
  return { ending: state.ending, metrics, review, assisted: assisted(state), assistanceStep: state.revealedAt };
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
  const { rank } = (item as CardValueItem).card;
  if (state.content.category === 'card-values') return { kind: 'hi-lo-value', rank, value: hiLo(item) };
  const count = countThrough(state, state.position);
  return { kind: 'running-count', rank, value: hiLo(item), before: count - hiLo(item), count };
}

const copyItem = (item: ChallengeItem): ChallengeItem => ('card' in item ? { card: { ...item.card } } : { ...item });

export function readChallengeView(state: ChallengeState): ChallengeView {
  const shown = SHOWING.includes(state.phase);
  const item = shown ? (state.items[state.position] as ChallengeItem) : null;
  const answered = state.phase === 'explanation' || state.phase === 'recorded' ? (currentAnswers(state) as ItemAnswers) : null;
  const counting = state.content.category === 'running-count';
  const base: ChallengeViewBase = {
    attemptId: state.attempt.id,
    category: state.identities.category,
    phase: state.phase,
    sequence: state.sequence,
    legalCommands: [...legalCommands(state)],
    length: state.content.length,
    position: item ? state.position + 1 : 0,
    item: item && copyItem(item),
    choices: item && state.content.category === 'card-values' ? HI_LO_VALUES : [],
    countRange: countRange(state.content),
    checkpoints: state.content.category === 'running-count' && state.variant === 'check' ? [...state.content.checkpoints] : null,
    countAid: counting ? { revealed: state.revealedAt !== null, count: item && state.revealedAt !== null ? countThrough(state, state.position) : null } : null,
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
      { attemptId: attempt.id, owner: attempt.owner, device: attempt.device, variant: value.variant, content: value.content } as ChallengeSpecification,
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
