// The strategy interpreter. Strategies are validated, immutable, revisioned
// instruction data (no author code): parameters chosen before a session,
// counters with declared caps, conditional instructions with explicit
// priorities or exceptions, atomic bet groups, outcome adjustments and a stop
// rule. Nothing here knows a game's rules: each game module supplies a
// strategy vocabulary (its situation subjects, targets and table conditions),
// so the same interpreter serves every game. Every function is pure.

import { canonicalJson } from './canonical';
import { add, compare, decodeMoney, encodeMoney, money, mul, sub, MoneyFormatError, type Money } from './money';
import { isRecord } from './shape';
import { decodeStrategyLiteral, StrategyEnvelopeError, withinStrategyBits } from './strategy-envelope';

/** The strategy envelope (spec #51, Exact money and limits). */
export const STRATEGY_ENVELOPE = {
  instructions: 256,
  /** all/any nesting. */
  depth: 8,
  /** Expression and condition nodes across the whole definition. */
  expressionNodes: 4096,
  /** UTF-8 bytes of the canonical definition. */
  bytes: 1_048_576,
} as const;

export const STRATEGY_FORMAT = 1 as const;

/** A numeric expression. No exponentiation, shifts, recursion or iteration. */
export type StrategyExpression =
  | { readonly lit: string }
  | { readonly counter: string }
  | { readonly add: readonly [StrategyExpression, StrategyExpression] }
  | { readonly sub: readonly [StrategyExpression, StrategyExpression] }
  | { readonly mul: readonly [StrategyExpression, StrategyExpression] }
  | { readonly min: readonly StrategyExpression[] }
  | { readonly max: readonly StrategyExpression[] };

/** The interpreter's own subject: the strategy's previous turn result. */
export type TurnResult = 'win' | 'loss' | 'push' | 'none';

export type StrategyCondition =
  | { readonly always: true }
  | { readonly all: readonly StrategyCondition[] }
  | { readonly any: readonly StrategyCondition[] }
  /** An enumerated subject (the strategy's "last-result", or one of the game vocabulary's) equals a value. */
  | { readonly subject: string; readonly is: string }
  | { readonly compare: StrategyExpression; readonly op: 'lt' | 'le' | 'eq' | 'ge' | 'gt'; readonly to: StrategyExpression };

/** A bet's target: a fixed one, or a parameter chosen before the session. */
export type StrategyTarget = { readonly target: string } | { readonly param: string };

export interface StrategyBet {
  readonly target: StrategyTarget;
  readonly amount: StrategyExpression;
}

export interface StrategyInstruction {
  readonly id: string;
  /** Shown in explanations; never changes behaviour. */
  readonly label: string;
  readonly when: StrategyCondition;
  /** Higher wins over a lower one where both match and touch the same bet. Display order never does. */
  readonly priority?: number;
  /** Instructions this one is an explicit exception to. */
  readonly overrides?: readonly string[];
  /** An atomic group: placed completely or not at all. */
  readonly bets: readonly StrategyBet[];
  /** An author note, for teaching only. */
  readonly note?: string;
}

export interface StrategyParameter {
  readonly id: string;
  readonly label: string;
  readonly choices: readonly string[];
  readonly default: string;
  /** Another parameter this one must differ from (two dozens, not one twice). */
  readonly distinctFrom?: string;
}

export interface StrategyCounter {
  readonly id: string;
  readonly initial: string;
  /** The largest value the counter may reach; beyond it the strategy pauses at its cap. */
  readonly cap?: string;
}

export interface StrategyAdjustment {
  readonly id: string;
  /** Applied after a coached turn settles with this result. */
  readonly on: 'win' | 'loss' | 'push' | 'any';
  readonly counter: string;
  readonly to: StrategyExpression;
}

export interface StrategyDefinition {
  readonly format: typeof STRATEGY_FORMAT;
  readonly id: string;
  readonly revision: number;
  readonly name: string;
  readonly game: string;
  /** The strategy's declared table conditions, in its game vocabulary's terms. */
  readonly table: unknown;
  readonly parameters: readonly StrategyParameter[];
  readonly counters: readonly StrategyCounter[];
  readonly instructions: readonly StrategyInstruction[];
  readonly adjustments: readonly StrategyAdjustment[];
  /** When it matches, the strategy places no new bets (a declared stop). */
  readonly stopWhen: StrategyCondition | null;
  /**
   * A playing policy in the game vocabulary's terms, for games with playing
   * decisions (blackjack). With one, the betting instructions may be empty:
   * the player then chooses the wagers and only the play is assessed.
   */
  readonly play?: unknown;
  readonly note?: string;
}

/** A strategy revision with the choices made for one session: what a guided activity pins. */
export interface StrategySelection {
  readonly definition: StrategyDefinition;
  readonly parameters: Readonly<Record<string, string>>;
}

export type DiagnosticCategory = 'incomplete' | 'conflict' | 'incompatible' | 'envelope' | 'unbounded';

export interface StrategyDiagnostic {
  readonly category: DiagnosticCategory;
  /** JSON-pointer path into the definition ("/instructions/0/bets/1/amount"). */
  readonly path: string;
  readonly message: string;
}

export interface StrategyValidation {
  readonly diagnostics: readonly StrategyDiagnostic[];
  /**
   * Amendment 7: no incomplete, conflict, envelope or unbounded diagnostic, and
   * no incompatibility with the strategy's own declared table conditions.
   */
  readonly runnable: boolean;
}

/** Why a bet can't be made under some table conditions. */
export type BetRequirement = 'not-on-layout' | 'not-whole-units' | 'below-minimum' | 'above-maximum';

/** What a game module tells the interpreter. Tables are the vocabulary's own shape (declared or actual). */
export interface StrategyVocabulary<Situation = unknown> {
  readonly game: string;
  /** Enumerated situation subjects and their values. */
  readonly subjects: Readonly<Record<string, readonly string[]>>;
  /** Problems with a declared table, as paths relative to it. */
  tableProblems(table: unknown): readonly { readonly path: string; readonly message: string }[];
  /** Why the target can't take the amount under the table, with the limit it fails, if any. */
  betRequirement(table: unknown, target: string, amount: Money): { readonly requirement: BetRequirement; readonly limit?: string } | undefined;
  /** Requirements of the declared table that an actual table fails, beyond bet amounts (a roulette wheel, say). */
  tableMismatch(declared: unknown, actual: unknown): readonly { readonly path: string; readonly requirement: string }[];
  /** Why a situation can't be represented or contradicts the rules, if it can't. */
  situationProblem(situation: unknown): string | undefined;
  /** The actual table of a valid situation, in the declared-table shape. */
  tableOf(situation: Situation): unknown;
  /** Funds the player can commit to this decision. */
  available(situation: Situation): Money;
  subject(situation: Situation, name: string): string;
  /**
   * Problems with a definition's playing policy under its declared table, as
   * paths from the definition root; absent for games without playing decisions.
   */
  playProblems?(play: unknown, table: unknown): readonly { readonly path: string; readonly message: string; readonly category?: DiagnosticCategory }[];
}

/** A playing move assessed against a pinned policy before it executes. */
export interface PlayAssessment<Explanation = unknown, Move = unknown, Command = unknown> {
  readonly explanation: Explanation;
  readonly actual: Move;
  readonly follows: boolean;
  /** The command that plays the prescription. */
  readonly prescribed: Command;
}

/** A game's part of guided practice, registered in strategies.ts. */
export interface StrategyGame<State = never> {
  readonly vocabulary: StrategyVocabulary;
  /** The game's pinned rule content, in the vocabulary's table shape. */
  tableForRules(rules: unknown): unknown;
  /** The betting situation the strategy sees in an activity state waiting for a decision. */
  situation(state: State): unknown;
  /** The command's playing decision assessed against the definition's policy; undefined when the command makes none. */
  assessPlay?(state: State, definition: StrategyDefinition, command: unknown): PlayAssessment | undefined;
}

/** Where a strategy cycle stands. */
export interface StrategyProgress {
  /** Counter values, canonical money, keyed by counter id. */
  readonly counters: Readonly<Record<string, string>>;
  readonly lastResult: TurnResult;
  /** Coached turns settled in this cycle. */
  readonly cycleTurn: number;
}

/** Why a prescription waits instead of placing its group. */
export type PauseReason = 'unfunded-group' | 'limit' | 'cap' | 'stop';

export interface PrescribedBet {
  readonly target: string;
  readonly amount: string;
}

/** An instruction's atomic group that can't execute now, and why. */
export interface HeldGroup {
  readonly instruction: string;
  readonly reason: PauseReason;
  readonly unavailable: readonly PrescribedBet[];
}

export type Prescription =
  /** The groups that execute; each other matching group is held whole (an atomic group never executes in part). */
  | { readonly status: 'prescribed'; readonly bets: readonly PrescribedBet[]; readonly held: readonly HeldGroup[] }
  /** A pending strategy action: the group can't execute, so no new bets until it can. */
  | { readonly status: 'paused'; readonly reason: PauseReason; readonly unavailable: readonly PrescribedBet[] }
  /** No instruction covers the situation: no new bets. */
  | { readonly status: 'uncovered' };

/** Structured explanation facts; the app renders them as prose. */
export interface Explanation {
  readonly situation: { readonly available: string; readonly subjects: Readonly<Record<string, string>> };
  /** The matching instructions that prescribed, in priority order. */
  readonly instructions: readonly { readonly id: string; readonly label: string }[];
  readonly prescription: Prescription;
  /** What happens instead when the prescription (or part of it) can't be followed: no new bets for what is held. */
  readonly fallback: 'no-new-bets' | null;
  /** The strategy state the prescription follows from; the outcome's adjustment comes after settlement, as its own step. */
  readonly state: StrategyProgress;
}

// ---- shape helpers --------------------------------------------------------

const isText = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 128;
const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

/** UTF-8 byte length, without TextEncoder. */
function utf8Bytes(text: string): number {
  let bytes = 0;
  for (const char of text) {
    const code = char.codePointAt(0) as number;
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return bytes;
}

/** The deepest nesting the validator walks before giving up on a node (well under any stack limit). */
const MAX_WALK_DEPTH = 64;

const ZERO = money(0n);

// ---- validate -------------------------------------------------------------

interface Checker {
  readonly diagnostics: StrategyDiagnostic[];
  nodes: number;
  readonly counters: ReadonlySet<string>;
}

const report = (checker: Checker, category: DiagnosticCategory, path: string, message: string) => {
  checker.diagnostics.push({ category, path, message });
};

/** A literal's value, reporting a malformed or oversized one. */
function literal(checker: Checker, text: unknown, path: string): Money | undefined {
  if (typeof text !== 'string') return void report(checker, 'incomplete', path, 'a number is required');
  try {
    return decodeStrategyLiteral(text);
  } catch (error) {
    if (error instanceof StrategyEnvelopeError) return void report(checker, 'envelope', path, error.message);
    if (error instanceof MoneyFormatError) return void report(checker, 'incomplete', path, `${text} is not a canonical number`);
    throw error;
  }
}

/** Checks an expression; returns false when it is malformed (already reported). Records counters it reads. */
function checkExpression(checker: Checker, value: unknown, path: string, depth: number, reads: Set<string>): boolean {
  checker.nodes++;
  if (depth > MAX_WALK_DEPTH) return report(checker, 'envelope', path, 'expressions are nested too deeply'), false;
  if (!isRecord(value) || Object.keys(value).length !== 1) return report(checker, 'incomplete', path, 'an expression is required'), false;
  const [key, operand] = Object.entries(value)[0] as [string, unknown];
  switch (key) {
    case 'lit':
      return literal(checker, operand, path) !== undefined;
    case 'counter':
      if (!checker.counters.has(operand as string)) return report(checker, 'incomplete', path, `no counter ${String(operand)}`), false;
      reads.add(operand as string);
      return true;
    case 'add':
    case 'sub':
    case 'mul':
    case 'min':
    case 'max': {
      const pair = key === 'add' || key === 'sub' || key === 'mul';
      if (!Array.isArray(operand) || (pair ? operand.length !== 2 : operand.length < 1 || operand.length > STRATEGY_ENVELOPE.expressionNodes)) {
        return report(checker, 'incomplete', path, `${key} needs ${pair ? 'two operands' : 'operands'}`), false;
      }
      let ok = true;
      for (const [index, item] of operand.entries()) ok = checkExpression(checker, item, `${path}/${key}/${index}`, depth + 1, reads) && ok;
      return ok;
    }
    default:
      return report(checker, 'incomplete', path, `unknown expression ${key}`), false;
  }
}

const COMPARISONS = ['lt', 'le', 'eq', 'ge', 'gt'];

function checkCondition(checker: Checker, vocabulary: StrategyVocabulary, value: unknown, path: string, depth: number): boolean {
  checker.nodes++;
  if (!isRecord(value)) return report(checker, 'incomplete', path, 'a condition is required'), false;
  if ('all' in value || 'any' in value) {
    const key = 'all' in value ? 'all' : 'any';
    if (depth >= STRATEGY_ENVELOPE.depth) return report(checker, 'envelope', path, `all/any may nest at most ${STRATEGY_ENVELOPE.depth} deep`), false;
    const items = value[key];
    if (Object.keys(value).length !== 1 || !Array.isArray(items) || items.length === 0) return report(checker, 'incomplete', path, `${key} needs conditions`), false;
    if (items.length > STRATEGY_ENVELOPE.expressionNodes) return report(checker, 'envelope', path, 'too many conditions'), false;
    let ok = true;
    for (const [index, item] of items.entries()) ok = checkCondition(checker, vocabulary, item, `${path}/${key}/${index}`, depth + 1) && ok;
    return ok;
  }
  if ('always' in value) return value.always === true && Object.keys(value).length === 1 ? true : (report(checker, 'incomplete', path, 'always must be true'), false);
  if ('subject' in value) {
    const subject = value.subject as string;
    // Only the vocabulary's own subjects: never an inherited property of the map.
    const values = subject === 'last-result' ? RESULTS : Object.hasOwn(vocabulary.subjects, subject) ? vocabulary.subjects[subject] : undefined;
    if (Object.keys(value).length !== 2 || !values) return report(checker, 'incomplete', path, `unknown subject ${String(value.subject)}`), false;
    if (!values.includes(value.is as string)) return report(checker, 'incomplete', `${path}/is`, `${String(value.subject)} is never ${String(value.is)}`), false;
    return true;
  }
  if ('compare' in value) {
    if (Object.keys(value).length !== 3 || !COMPARISONS.includes(value.op as string)) return report(checker, 'incomplete', path, 'a comparison needs compare, op and to'), false;
    const reads = new Set<string>();
    const left = checkExpression(checker, value.compare, `${path}/compare`, 0, reads);
    return checkExpression(checker, value.to, `${path}/to`, 0, reads) && left;
  }
  return report(checker, 'incomplete', path, 'unknown condition'), false;
}

const RESULTS: readonly TurnResult[] = ['win', 'loss', 'push', 'none'];

/**
 * Validates a strategy definition: structure, references, the envelope, its
 * own declared table conditions, conflicts and bounds. Diagnostics come in
 * category order of discovery, each with its path.
 */
export function validateWith(vocabulary: StrategyVocabulary, definition: unknown, configuration?: unknown): StrategyValidation {
  const diagnostics: StrategyDiagnostic[] = [];
  const done = () => ({ diagnostics, runnable: diagnostics.length === 0 });
  if (!isRecord(definition)) return diagnostics.push({ category: 'incomplete', path: '', message: 'a strategy definition is an object' }), done();
  let text: string;
  try {
    text = canonicalJson(definition);
  } catch {
    return diagnostics.push({ category: 'incomplete', path: '', message: 'the definition is not plain data' }), done();
  }
  if (utf8Bytes(text) > STRATEGY_ENVELOPE.bytes) {
    return diagnostics.push({ category: 'envelope', path: '/', message: `a definition is at most ${STRATEGY_ENVELOPE.bytes} bytes of UTF-8` }), done();
  }
  const def = definition;
  const counterIds = new Set<string>();
  const checker: Checker = { diagnostics, nodes: 0, counters: counterIds };
  const flag = (category: DiagnosticCategory, path: string, message: string) => report(checker, category, path, message);

  if (def.format !== STRATEGY_FORMAT) flag('incomplete', '/format', `unsupported strategy format ${String(def.format)}`);
  if (!isText(def.id)) flag('incomplete', '/id', 'an id is required');
  if (!isCount(def.revision)) flag('incomplete', '/revision', 'a revision number is required');
  if (!isText(def.name)) flag('incomplete', '/name', 'a name is required');
  if (def.game !== vocabulary.game) flag('incomplete', '/game', `this vocabulary is for ${vocabulary.game}`);
  if ('note' in def && typeof def.note !== 'string') flag('incomplete', '/note', 'a note is text');
  const tableProblems = vocabulary.tableProblems(def.table);
  for (const problem of tableProblems) flag('incomplete', `/table${problem.path}`, problem.message);
  const tableOk = tableProblems.length === 0;

  // Parameters.
  const parameters = Array.isArray(def.parameters) ? def.parameters : (flag('incomplete', '/parameters', 'parameters are a list'), []);
  const paramIds = new Map<string, readonly string[]>();
  const distinct = new Set<string>();
  for (const [index, param] of parameters.entries()) {
    const path = `/parameters/${index}`;
    if (!isRecord(param) || !isText(param.id) || !isText(param.label) || !Array.isArray(param.choices) || param.choices.length === 0) {
      flag('incomplete', path, 'a parameter needs an id, a label and choices');
      continue;
    }
    if (paramIds.has(param.id)) flag('incomplete', `${path}/id`, `parameter ${param.id} is declared twice`);
    const choices = param.choices.filter((choice): choice is string => isText(choice));
    if (choices.length !== param.choices.length || new Set(choices).size !== choices.length) flag('incomplete', `${path}/choices`, 'choices are distinct targets');
    if (!choices.includes(param.default as string)) flag('incomplete', `${path}/default`, 'the default must be one of the choices');
    paramIds.set(param.id, choices);
    if (tableOk) {
      for (const [choiceIndex, choice] of choices.entries()) {
        if (vocabulary.betRequirement(def.table, choice, money(1n))?.requirement === 'not-on-layout') {
          flag('incompatible', `${path}/choices/${choiceIndex}`, `${choice} isn't a bet under the declared table conditions`);
        }
      }
    }
  }
  for (const [index, param] of parameters.entries()) {
    if (!isRecord(param) || param.distinctFrom === undefined) continue;
    if (!paramIds.has(param.distinctFrom as string) || param.distinctFrom === param.id) flag('incomplete', `/parameters/${index}/distinctFrom`, 'distinctFrom names another parameter');
    else distinct.add(`${param.id}|${String(param.distinctFrom)}`).add(`${String(param.distinctFrom)}|${param.id}`);
  }

  // Counters.
  const counters = Array.isArray(def.counters) ? def.counters : (flag('incomplete', '/counters', 'counters are a list'), []);
  const capped = new Set<string>();
  for (const [index, counter] of counters.entries()) {
    const path = `/counters/${index}`;
    if (!isRecord(counter) || !isText(counter.id)) {
      flag('incomplete', path, 'a counter needs an id');
      continue;
    }
    if (counterIds.has(counter.id)) flag('incomplete', `${path}/id`, `counter ${counter.id} is declared twice`);
    counterIds.add(counter.id);
    literal(checker, counter.initial, `${path}/initial`);
    if (counter.cap !== undefined && literal(checker, counter.cap, `${path}/cap`)) capped.add(counter.id);
  }

  // A playing policy, where the game has playing decisions.
  const hasPlay = 'play' in def;
  if (hasPlay) {
    if (!vocabulary.playProblems) flag('incomplete', '/play', `${vocabulary.game} strategies have no playing policy`);
    else if (tableOk) for (const problem of vocabulary.playProblems(def.play, def.table)) flag(problem.category ?? 'incomplete', problem.path, problem.message);
  }

  // Instructions. A strategy with a playing policy may leave the betting to the player.
  const instructions = Array.isArray(def.instructions) ? def.instructions : [];
  if (!Array.isArray(def.instructions) || (instructions.length === 0 && !hasPlay)) flag('incomplete', '/instructions', 'a strategy needs at least one instruction');
  if (instructions.length > STRATEGY_ENVELOPE.instructions) {
    flag('envelope', '/instructions', `a strategy has at most ${STRATEGY_ENVELOPE.instructions} instructions`);
    return done();
  }
  const instructionIds = new Set<string>();
  const usable: { index: number; id: string; priority: number | null; overrides: string[]; when: StrategyCondition; targets: Set<string>[] }[] = [];
  for (const [index, item] of instructions.entries()) {
    const path = `/instructions/${index}`;
    if (!isRecord(item) || !isText(item.id) || typeof item.label !== 'string') {
      flag('incomplete', path, 'an instruction needs an id and a label');
      continue;
    }
    if (instructionIds.has(item.id)) flag('incomplete', `${path}/id`, `instruction ${item.id} is declared twice`);
    instructionIds.add(item.id);
    if (item.priority !== undefined && !(typeof item.priority === 'number' && Number.isSafeInteger(item.priority))) flag('incomplete', `${path}/priority`, 'a priority is a whole number');
    if ('note' in item && typeof item.note !== 'string') flag('incomplete', `${path}/note`, 'a note is text');
    const whenOk = checkCondition(checker, vocabulary, item.when, `${path}/when`, 0);
    const bets = Array.isArray(item.bets) ? item.bets : [];
    if (bets.length === 0) flag('incomplete', `${path}/bets`, 'an instruction places at least one bet');
    const targets: Set<string>[] = [];
    const betParams: (string | null)[] = [];
    for (const [betIndex, bet] of bets.entries()) {
      const betPath = `${path}/bets/${betIndex}`;
      if (!isRecord(bet)) {
        flag('incomplete', betPath, 'a bet needs a target and an amount');
        continue;
      }
      const reads = new Set<string>();
      const amountOk = checkExpression(checker, bet.amount, `${betPath}/amount`, 0, reads);
      let possible: Set<string> | null = null;
      const target = bet.target;
      if (isRecord(target) && 'target' in target && isText(target.target)) {
        possible = new Set([target.target]);
        betParams.push(null);
        if (tableOk && vocabulary.betRequirement(def.table, target.target, money(1n))?.requirement === 'not-on-layout') {
          flag('incompatible', `${betPath}/target`, `${target.target} isn't a bet under the declared table conditions`);
        }
      } else if (isRecord(target) && 'param' in target && paramIds.has(target.param as string)) {
        possible = new Set(paramIds.get(target.param as string));
        betParams.push(target.param as string);
      } else {
        flag('incomplete', `${betPath}/target`, 'a bet names a target or a parameter');
        betParams.push(null);
      }
      if (possible) targets.push(possible);
      // A fixed amount must fit the declared table for every target the bet may take.
      if (amountOk && possible && tableOk && reads.size === 0) {
        const amount = evaluate(bet.amount as StrategyExpression, {});
        for (const choice of possible) {
          const failed = amount && vocabulary.betRequirement(def.table, choice, amount);
          if (failed && failed.requirement !== 'not-on-layout') {
            flag('incompatible', `${betPath}/amount`, `${encodeMoney(amount)} on ${choice} fails the declared table (${failed.requirement})`);
            break;
          }
        }
      }
    }
    // Two bets in one group that may name the same target are two prescriptions for one bet.
    for (let a = 0; a < targets.length; a++) {
      for (let b = a + 1; b < targets.length; b++) {
        const declaredDistinct = betParams[a] && betParams[b] && distinct.has(`${betParams[a]}|${betParams[b]}`);
        if (!declaredDistinct && overlaps(targets[a] as Set<string>, targets[b] as Set<string>)) {
          flag('conflict', `${path}/bets/${b}`, 'two bets in this group may land on the same target');
        }
      }
    }
    const overrides = Array.isArray(item.overrides) ? item.overrides : [];
    if (item.overrides !== undefined && !Array.isArray(item.overrides)) flag('incomplete', `${path}/overrides`, 'overrides is a list of instruction ids');
    if (whenOk) {
      usable.push({
        index,
        id: item.id,
        priority: typeof item.priority === 'number' ? item.priority : null,
        overrides: overrides.filter((id): id is string => typeof id === 'string'),
        when: item.when as StrategyCondition,
        targets,
      });
    }
  }
  for (const [index, item] of instructions.entries()) {
    if (!isRecord(item) || !Array.isArray(item.overrides)) continue;
    for (const [o, id] of item.overrides.entries()) {
      if (!instructionIds.has(id as string) || id === item.id) flag('incomplete', `/instructions/${index}/overrides/${o}`, `no other instruction ${String(id)}`);
    }
  }

  // Conservative conflicts: two instructions that may match together and may bet the same target,
  // unless one has an explicit priority or exception over the other, or their conditions are provably disjoint.
  for (let a = 0; a < usable.length; a++) {
    for (let b = a + 1; b < usable.length; b++) {
      const [x, y] = [usable[a], usable[b]] as [(typeof usable)[number], (typeof usable)[number]];
      const share = x.targets.some((tx) => y.targets.some((ty) => overlaps(tx, ty)));
      if (!share || ranked(x, y) !== 0 || disjoint(x.when, y.when)) continue;
      flag('conflict', `/instructions/${y.index}`, `instructions ${x.id} and ${y.id} may both prescribe the same bet; give one a priority or an exception`);
    }
  }

  // Adjustments.
  const adjustments = Array.isArray(def.adjustments) ? def.adjustments : (flag('incomplete', '/adjustments', 'adjustments are a list'), []);
  const grows = new Set<string>();
  for (const [index, item] of adjustments.entries()) {
    const path = `/adjustments/${index}`;
    if (!isRecord(item) || !isText(item.id) || !['win', 'loss', 'push', 'any'].includes(item.on as string)) {
      flag('incomplete', path, 'an adjustment needs an id, a result and a counter');
      continue;
    }
    if (!counterIds.has(item.counter as string)) {
      flag('incomplete', `${path}/counter`, `no counter ${String(item.counter)}`);
      continue;
    }
    const reads = new Set<string>();
    if (checkExpression(checker, item.to, `${path}/to`, 0, reads) && reads.has(item.counter as string)) grows.add(item.counter as string);
  }

  // Stop rule.
  const stopOk = def.stopWhen === null || checkCondition(checker, vocabulary, def.stopWhen, '/stopWhen', 0);
  if (!stopOk && def.stopWhen === undefined) flag('incomplete', '/stopWhen', 'stopWhen is a condition or null');

  // A counter that grows from itself needs a declared cap or a stop rule.
  for (const [index, counter] of counters.entries()) {
    if (isRecord(counter) && grows.has(counter.id as string) && !capped.has(counter.id as string) && def.stopWhen === null) {
      flag('unbounded', `/counters/${index}`, `counter ${String(counter.id)} can grow without a declared cap or stop`);
    }
  }

  if (checker.nodes > STRATEGY_ENVELOPE.expressionNodes) {
    flag('envelope', '/', `a strategy has at most ${STRATEGY_ENVELOPE.expressionNodes} expression and condition nodes`);
  }
  // Configuration: the choices made for a session, when given.
  if (configuration !== undefined && diagnostics.length === 0) {
    const problem = parameterProblem(def as unknown as StrategyDefinition, configuration);
    if (problem) flag('incomplete', '/parameters', problem);
  }
  return done();
}

const overlaps = (a: ReadonlySet<string>, b: ReadonlySet<string>) => [...a].some((item) => b.has(item));

/** Plain string order, for deterministic output whatever the input order. */
const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** A bet's target with the session's choices filled in. */
const resolveTarget = (target: StrategyTarget, parameters: Readonly<Record<string, string>>): string =>
  'target' in target ? target.target : (parameters[target.param] as string);

/** >0 when x wins over y, <0 when y wins over x, 0 when neither is ranked over the other (never by position). */
function ranked(x: { id: string; priority: number | null; overrides: readonly string[] }, y: { id: string; priority: number | null; overrides: readonly string[] }): number {
  if (x.overrides.includes(y.id)) return 1;
  if (y.overrides.includes(x.id)) return -1;
  // An explicit priority ranks over none; equal priorities rank nothing.
  if (x.priority !== null && y.priority === null) return 1;
  if (x.priority === null && y.priority !== null) return -1;
  if (x.priority !== null && y.priority !== null) return x.priority - y.priority;
  return 0;
}

/** Atomic subject tests a condition definitely requires (only through "all"). */
function required(condition: StrategyCondition): { subject: string; is: string }[] {
  if ('subject' in condition) return [condition];
  if ('all' in condition) return condition.all.flatMap(required);
  return [];
}

/** True only when the two conditions provably can't both hold: they require different values of one subject. */
function disjoint(a: StrategyCondition, b: StrategyCondition): boolean {
  if ('any' in a) return a.any.every((item) => disjoint(item, b));
  if ('any' in b) return b.any.every((item) => disjoint(a, item));
  const left = required(a);
  return required(b).some((r) => left.some((l) => l.subject === r.subject && l.is !== r.is));
}

// ---- evaluate -------------------------------------------------------------

/** Evaluates an expression; undefined when an intermediate leaves the 256-bit envelope. */
function evaluate(expression: StrategyExpression, counters: Readonly<Record<string, string>>): Money | undefined {
  const value = ((): Money | undefined => {
    if ('lit' in expression) return decodeStrategyLiteral(expression.lit);
    if ('counter' in expression) return decodeMoney(counters[expression.counter] as string);
    const operands = 'add' in expression ? expression.add : 'sub' in expression ? expression.sub : 'mul' in expression ? expression.mul : 'min' in expression ? expression.min : expression.max;
    const values: Money[] = [];
    for (const operand of operands) {
      const v = evaluate(operand, counters);
      if (!v) return undefined;
      values.push(v);
    }
    const [first, second] = values as [Money, Money];
    if ('add' in expression) return add(first, second);
    if ('sub' in expression) return sub(first, second);
    if ('mul' in expression) return mul(first, second);
    const pick = 'min' in expression ? -1 : 1;
    return values.reduce((best, v) => (compare(v, best) === pick ? v : best));
  })();
  return value && withinStrategyBits(value) ? value : undefined;
}

function holds<S>(vocabulary: StrategyVocabulary<S>, condition: StrategyCondition, situation: S, progress: StrategyProgress): boolean | undefined {
  if ('always' in condition) return true;
  if ('all' in condition) {
    let result: boolean | undefined = true;
    for (const item of condition.all) {
      const value = holds(vocabulary, item, situation, progress);
      if (value === undefined) return undefined;
      result = result && value;
    }
    return result;
  }
  if ('any' in condition) {
    let result = false;
    for (const item of condition.any) {
      const value = holds(vocabulary, item, situation, progress);
      if (value === undefined) return undefined;
      result = result || value;
    }
    return result;
  }
  if ('subject' in condition) {
    const actual = condition.subject === 'last-result' ? progress.lastResult : vocabulary.subject(situation, condition.subject);
    return actual === condition.is;
  }
  const left = evaluate(condition.compare, progress.counters);
  const right = evaluate(condition.to, progress.counters);
  if (!left || !right) return undefined;
  const order = compare(left, right);
  return { lt: order < 0, le: order <= 0, eq: order === 0, ge: order >= 0, gt: order > 0 }[condition.op];
}

/** A parameter choice set's problem, if any. Choices are validated against the definition. */
export function parameterProblem(definition: StrategyDefinition, parameters: unknown): string | undefined {
  if (!isRecord(parameters)) return 'parameters are a map of choices';
  const ids = definition.parameters.map((param) => param.id);
  if (Object.keys(parameters).sort().join() !== [...ids].sort().join()) return `choose ${ids.join(', ') || 'no parameters'}`;
  for (const param of definition.parameters) {
    const value = parameters[param.id];
    if (!param.choices.includes(value as string)) return `${param.label} must be one of ${param.choices.join(', ')}`;
    if (param.distinctFrom !== undefined && parameters[param.distinctFrom] === value) return `${param.label} must differ from the other choice`;
  }
  return undefined;
}

/** The progress a fresh cycle starts from. */
export const initialProgress = (definition: StrategyDefinition): StrategyProgress => ({
  counters: Object.fromEntries(definition.counters.map((counter) => [counter.id, encodeMoney(decodeStrategyLiteral(counter.initial))])),
  lastResult: 'none',
  cycleTurn: 0,
});

/** A stored progress's problem against the definition, if any. */
export function progressProblem(definition: StrategyDefinition, progress: unknown): string | undefined {
  if (!isRecord(progress) || Object.keys(progress).sort().join() !== 'counters,cycleTurn,lastResult') return 'damaged strategy progress';
  if (!RESULTS.includes(progress.lastResult as TurnResult) || !isCount(progress.cycleTurn)) return 'damaged strategy progress';
  const counters = progress.counters;
  if (!isRecord(counters) || Object.keys(counters).sort().join() !== definition.counters.map((c) => c.id).sort().join()) return 'damaged strategy counters';
  for (const value of Object.values(counters)) {
    try {
      if (typeof value !== 'string' || value.length > 200 || encodeMoney(decodeMoney(value)) !== value || !withinStrategyBits(decodeMoney(value))) return 'damaged strategy counters';
    } catch {
      return 'damaged strategy counters';
    }
  }
  return undefined;
}

/**
 * The prescription for one betting decision, with its explanation facts. The
 * definition, parameters, situation and progress must already be valid. Pure;
 * draws nothing.
 */
export function prescribe<S>(
  vocabulary: StrategyVocabulary<S>,
  definition: StrategyDefinition,
  parameters: Readonly<Record<string, string>>,
  situation: S,
  progress: StrategyProgress,
): Explanation {
  const available = vocabulary.available(situation);
  const subjects: Record<string, string> = { 'last-result': progress.lastResult };
  for (const name of Object.keys(vocabulary.subjects).sort()) subjects[name] = vocabulary.subject(situation, name);
  const base = { situation: { available: encodeMoney(available), subjects }, state: progress };
  const pause = (reason: PauseReason, unavailable: PrescribedBet[], instructions: Explanation['instructions'] = []): Explanation => ({
    ...base,
    instructions,
    prescription: { status: 'paused', reason, unavailable },
    fallback: 'no-new-bets',
  });

  if (definition.stopWhen && holds(vocabulary, definition.stopWhen, situation, progress) !== false) return pause('stop', []);
  for (const counter of definition.counters) {
    if (counter.cap !== undefined && compare(decodeMoney(progress.counters[counter.id] as string), decodeStrategyLiteral(counter.cap)) > 0) return pause('cap', []);
  }

  const matching = definition.instructions.filter((instruction) => holds(vocabulary, instruction.when, situation, progress) === true);
  const targetsOf = (instruction: StrategyInstruction) => new Set(instruction.bets.map((bet) => resolveTarget(bet.target, parameters)));
  const meta = (i: StrategyInstruction) => ({ id: i.id, priority: i.priority ?? null, overrides: i.overrides ?? [] });
  // Where two matching instructions touch one bet, only the ranked-higher one prescribes (Validate rules out unranked overlaps).
  const winners = matching.filter((instruction) =>
    !matching.some((other) => other !== instruction && overlaps(targetsOf(instruction), targetsOf(other)) && ranked(meta(other), meta(instruction)) > 0),
  );
  if (winners.length === 0) return { ...base, instructions: [], prescription: { status: 'uncovered' }, fallback: 'no-new-bets' };
  winners.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || byText(a.id, b.id));
  const named = winners.map((instruction) => ({ id: instruction.id, label: instruction.label }));

  // Each instruction's bets are one atomic group: placed whole or held whole. Funds go to groups in priority order.
  const table = vocabulary.tableOf(situation);
  const bets: PrescribedBet[] = [];
  const held: HeldGroup[] = [];
  let remaining = available;
  for (const instruction of winners) {
    const group: PrescribedBet[] = [];
    let overCap = false;
    for (const bet of instruction.bets) {
      const amount = evaluate(bet.amount, progress.counters);
      if (!amount) overCap = true;
      group.push({ target: resolveTarget(bet.target, parameters), amount: amount ? encodeMoney(amount) : '0' });
    }
    group.sort((a, b) => byText(a.target, b.target));
    const total = group.reduce((sum, bet) => add(sum, decodeMoney(bet.amount)), ZERO);
    const reason: PauseReason | null = overCap
      ? 'cap'
      : group.some((bet) => compare(decodeMoney(bet.amount), ZERO) <= 0 || vocabulary.betRequirement(table, bet.target, decodeMoney(bet.amount)))
        ? 'limit'
        : compare(total, remaining) > 0
          ? 'unfunded-group'
          : null;
    if (reason) {
      held.push({ instruction: instruction.id, reason, unavailable: group });
    } else {
      bets.push(...group);
      remaining = sub(remaining, total);
    }
  }
  bets.sort((a, b) => byText(a.target, b.target));
  if (bets.length === 0) {
    const first = held[0] as HeldGroup;
    const unavailable = held.flatMap((group) => group.unavailable).sort((a, b) => byText(a.target, b.target));
    return { ...base, instructions: named, prescription: { status: 'paused', reason: first.reason, unavailable }, fallback: 'no-new-bets' };
  }
  return { ...base, instructions: named, prescription: { status: 'prescribed', bets, held }, fallback: held.length > 0 ? 'no-new-bets' : null };
}

/** The progress after a coached turn settles with a result; undefined when an adjustment leaves the envelope. */
export function progressAfter(definition: StrategyDefinition, progress: StrategyProgress, result: Exclude<TurnResult, 'none'>): StrategyProgress | undefined {
  const counters: Record<string, string> = { ...progress.counters };
  for (const adjustment of definition.adjustments) {
    if (adjustment.on !== 'any' && adjustment.on !== result) continue;
    // Every adjustment reads the counters as they were before the turn settled.
    const value = evaluate(adjustment.to, progress.counters);
    if (!value) return undefined;
    counters[adjustment.counter] = encodeMoney(value);
  }
  return { counters, lastResult: result, cycleTurn: progress.cycleTurn + 1 };
}

/** One requirement an actual table fails for a strategy and its chosen parameters. */
export interface TableRequirement {
  readonly path: string;
  /** A bet requirement, "invalid-parameter", or a vocabulary's own table requirement ("wheel"). */
  readonly requirement: string;
  readonly target?: string;
  readonly amount?: string;
  readonly limit?: string;
}

/**
 * The requirements a different table (chosen at setup) fails for a valid
 * strategy and its parameters: the table kind, then every bet's starting
 * amount (counters at their initial values). Amounts are never adjusted.
 */
export function compatibilityWith(vocabulary: StrategyVocabulary, definition: StrategyDefinition, parameters: unknown, table: unknown): TableRequirement[] {
  const problem = parameterProblem(definition, parameters);
  if (problem) return [{ path: '/parameters', requirement: 'invalid-parameter' }];
  const chosen = parameters as Readonly<Record<string, string>>;
  const requirements: TableRequirement[] = [...vocabulary.tableMismatch(definition.table, table)];
  if (requirements.length > 0) return requirements;
  const { counters } = initialProgress(definition);
  for (const [index, instruction] of definition.instructions.entries()) {
    for (const [betIndex, bet] of instruction.bets.entries()) {
      const target = resolveTarget(bet.target, chosen);
      const amount = evaluate(bet.amount, counters);
      if (!amount) continue;
      const failed = vocabulary.betRequirement(table, target, amount);
      if (!failed) continue;
      const path = `/instructions/${index}/bets/${betIndex}/${failed.requirement === 'not-on-layout' ? 'target' : 'amount'}`;
      requirements.push({ path, target, amount: encodeMoney(amount), requirement: failed.requirement, ...(failed.limit === undefined ? {} : { limit: failed.limit }) });
    }
  }
  return requirements;
}
