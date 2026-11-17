// Spec 3 Modules › Engine; Challenge content (from #4); Learn, Check and assistance; Information hiding; #158, #132

import { STATE_SCHEMA_VERSION, type Receipt, type RejectionReason, type VersionedIdentity } from './activity';
import { hiLoTag } from './blackjack';
import { canonicalJson } from './canonical';
import type { Rank, Suit } from './draws';
import { RANDOM_PROTOCOL_VERSION, RandomStream, uniformInt, type RandomStreamIdentity, type RandomStreamState } from './random';
import { sha256Hex } from './sha256';
import { hasExactKeys, isCount, isRecord, isText } from './shape';
import { ENGINE_VERSION } from './version';

export type ChallengeCategory = 'card-values';

export const CHALLENGE_CATEGORIES: readonly ChallengeCategory[] = ['card-values'];

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

export type ChallengeContent = CardValuesContent;

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

export type ChallengeEntry = HiLoValue | 'skip';

export interface ItemAnswers {
  readonly first: ChallengeEntry;
  readonly last: ChallengeEntry;
  readonly tries: number;
}

export type ChallengePhase = 'ready' | 'question' | 'explanation' | 'recorded' | 'ended';

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
  readonly items: readonly CardValueItem[];
  readonly rejected: number;
  readonly answers: readonly ItemAnswers[];
  readonly random: RandomStreamState;
  readonly receipts: readonly Receipt[];
}

export type ChallengeCommand =
  | { readonly kind: 'begin' }
  | { readonly kind: 'answer'; readonly value: HiLoValue }
  | { readonly kind: 'skip' }
  | { readonly kind: 'retry-item' }
  | { readonly kind: 'next-item' }
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

export type HiLoExplanation = { readonly kind: 'hi-lo-value'; readonly rank: Rank; readonly value: HiLoValue };

export interface CardValueReview {
  readonly kind: 'card-value';
  readonly position: number;
  readonly card: ChallengeCard;
  readonly entered: ChallengeEntry;
  readonly reference: HiLoValue;
}

export type ReviewFact = CardValueReview;

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
  readonly reference: HiLoValue;
  readonly scored: boolean;
  readonly explanation: HiLoExplanation;
}

interface ChallengeViewBase {
  readonly attemptId: string;
  readonly category: ChallengeCategory;
  readonly phase: ChallengePhase;
  readonly sequence: number;
  readonly legalCommands: readonly ChallengeCommandKind[];
  readonly length: number;
  readonly position: number;
  readonly item: CardValueItem | null;
  readonly choices: readonly HiLoValue[];
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
  if (!hasExactKeys(content, ['category', 'id', 'version', 'length', 'coverage'])) return 'a card-values content definition has a category, id, version, length and coverage';
  if (content.category !== 'card-values') return `unsupported challenge category ${String(content.category)}`;
  if (!isText(content.id) || !isCount(content.version) || content.version < 1) return 'the content definition needs an id and a version from 1';
  if (content.coverage !== 'every-rank') return `unsupported coverage ${String(content.coverage)}`;
  if (!isCount(content.length) || content.length < RANK_COUNT || content.length > 52) return `every rank needs a length from ${RANK_COUNT} to 52`;
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
      reference: null,
      random: { protocol: position.protocol, key: position.key, session: position.session },
    },
    variant: spec.variant,
    content: { ...content },
    sequence: 0,
    phase: 'ready',
    ending: null,
    position: 0,
    items: [],
    rejected: 0,
    answers: [],
    random: position,
    receipts: [],
  };
}

// Spec 3 Challenge content › Generation
function generate(content: CardValuesContent, stream: RandomStream): { items: CardValueItem[]; rejected: number } {
  for (let rejected = 0; ; rejected++) {
    const items = Array.from({ length: content.length }, (): CardValueItem => {
      const index = uniformInt(stream, SUITS.length * RANK_COUNT);
      return { card: { suit: SUITS[Math.floor(index / RANK_COUNT)] as Suit, rank: ((index % RANK_COUNT) + 1) as Rank } };
    });
    if (new Set(items.map((item) => item.card.rank)).size === RANK_COUNT) return { items, rejected };
  }
}

const reference = (item: CardValueItem): HiLoValue => hiLoTag({ deck: 0, ...item.card }) as HiLoValue;

const isCorrect = (entry: ChallengeEntry, item: CardValueItem) => entry !== 'skip' && entry === reference(item);

const LEGAL: Record<ChallengePhase, readonly ChallengeCommandKind[]> = {
  ready: ['begin', 'end'],
  question: ['answer', 'skip', 'end'],
  explanation: ['retry-item', 'next-item', 'end'],
  recorded: ['next-item', 'end'],
  ended: [],
};

function legalCommands(state: ChallengeState): readonly ChallengeCommandKind[] {
  if (state.phase !== 'explanation') return LEGAL[state.phase];
  const answered = state.answers[state.position] as ItemAnswers;
  const item = state.items[state.position] as CardValueItem;
  return isCorrect(answered.last, item) ? ['next-item', 'end'] : LEGAL.explanation;
}

function isCommand(value: unknown): value is ChallengeCommand {
  if (!isRecord(value)) return false;
  switch (value.kind) {
    case 'answer':
      return hasExactKeys(value, ['kind', 'value']) && HI_LO_VALUES.includes(value.value as HiLoValue);
    case 'begin':
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
  const { change, facts } = apply(state, command);
  const receipt: Receipt = { commandId: envelope.commandId, sequence: state.sequence, command: commandText, disposition: 'applied' };
  return { status: 'committed', state: { ...state, ...change, sequence: state.sequence + 1, receipts: [...state.receipts, receipt] }, facts, receipt };
}

type Change = Partial<Pick<ChallengeState, 'phase' | 'ending' | 'position' | 'items' | 'rejected' | 'answers' | 'random'>>;

function apply(state: ChallengeState, command: ChallengeCommand): { change: Change; facts: ChallengeFact[] } {
  switch (command.kind) {
    case 'begin': {
      const stream = RandomStream.restore(state.random);
      const { items, rejected } = generate(state.content, stream);
      return { change: { phase: 'question', items, rejected, random: stream.state() }, facts: [{ kind: 'content-shown', position: 0 }] };
    }
    case 'answer':
    case 'skip': {
      const entry: ChallengeEntry = command.kind === 'skip' ? 'skip' : command.value;
      const earlier = state.answers[state.position];
      const answered: ItemAnswers = earlier ? { ...earlier, last: entry, tries: earlier.tries + 1 } : { first: entry, last: entry, tries: 1 };
      const answers = [...state.answers.slice(0, state.position), answered];
      return { change: { phase: state.variant === 'check' ? 'recorded' : 'explanation', answers }, facts: [{ kind: 'answer-accepted', position: state.position, scored: !earlier }] };
    }
    case 'retry-item':
      return { change: { phase: 'question' }, facts: [] };
    case 'next-item': {
      const position = state.position + 1;
      if (position < state.items.length) return { change: { phase: 'question', position }, facts: [{ kind: 'content-shown', position }] };
      return { change: { phase: 'ended', ending: 'completed', position }, facts: [{ kind: 'attempt-ended', ending: 'completed' }] };
    }
    case 'end':
      return { change: { phase: 'ended', ending: 'abandoned' }, facts: [{ kind: 'attempt-ended', ending: 'abandoned' }] };
  }
}

// Spec 3 Scoring and review
export function challengeResults(state: ChallengeState): ChallengeResults | null {
  if (state.phase !== 'ended' || state.ending === null) return null;
  const review: CardValueReview[] = state.answers.map((answers, index) => {
    const item = state.items[index] as CardValueItem;
    return { kind: 'card-value', position: index + 1, card: item.card, entered: answers.first, reference: reference(item) };
  });
  const metrics = Object.fromEntries(CHALLENGE_METRICS.map((metric) => [metric, null])) as Record<ChallengeMetric, MetricResult | null>;
  metrics['card-values'] = review.length === 0 ? null : { correct: review.filter((fact) => fact.entered === fact.reference).length, total: review.length };
  return { ending: state.ending, metrics, review, assisted: assisted(state), assistanceStep: null };
}

// Spec 3 Learn, Check and assistance
const assisted = (state: ChallengeState) => state.variant === 'learn';

export function readChallengeView(state: ChallengeState): ChallengeView {
  const shown = state.phase === 'question' || state.phase === 'explanation' || state.phase === 'recorded';
  const item = shown ? (state.items[state.position] as CardValueItem) : null;
  const answered = state.phase === 'explanation' || state.phase === 'recorded' ? (state.answers[state.position] as ItemAnswers) : null;
  const base: ChallengeViewBase = {
    attemptId: state.attempt.id,
    category: state.identities.category,
    phase: state.phase,
    sequence: state.sequence,
    legalCommands: [...legalCommands(state)],
    length: state.content.length,
    position: item ? state.position + 1 : 0,
    item: item && { card: { ...item.card } },
    choices: item ? HI_LO_VALUES : [],
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
            correct: isCorrect(answered.last, item),
            reference: reference(item),
            scored: answered.tries === 1,
            explanation: { kind: 'hi-lo-value', rank: item.card.rank, value: reference(item) },
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
