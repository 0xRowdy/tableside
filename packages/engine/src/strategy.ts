// docs/development.md Engine portability
import type { Command } from './activity';
import { canonicalJson } from './canonical';
import { add, compare, decodeMoney, encodeMoney, money, mul, sub, MoneyFormatError, type Money } from './money';
import { hasExactKeys, isRecord } from './shape';
import { decodeStrategyLiteral, StrategyEnvelopeError, withinStrategyBits } from './strategy-envelope';

// Spec 1 Exact money and limits
export const STRATEGY_ENVELOPE = {
  instructions: 256,
  depth: 8,
  expressionNodes: 4096,
  bytes: 1_048_576,
  listItems: 256,
} as const;

export const STRATEGY_FORMAT = 1 as const;

export type StrategyExpression =
  | { readonly lit: string }
  | { readonly counter: string }
  | { readonly first: string }
  | { readonly last: string }
  | { readonly length: string }
  | { readonly staked: true }
  | { readonly value: string }
  | { readonly add: readonly [StrategyExpression, StrategyExpression] }
  | { readonly sub: readonly [StrategyExpression, StrategyExpression] }
  | { readonly mul: readonly [StrategyExpression, StrategyExpression] }
  | { readonly min: readonly StrategyExpression[] }
  | { readonly max: readonly StrategyExpression[] };

export type TurnResult = 'win' | 'loss' | 'push' | 'none';

export type StrategyCondition =
  | { readonly always: true }
  | { readonly all: readonly StrategyCondition[] }
  | { readonly any: readonly StrategyCondition[] }
  | { readonly subject: string; readonly is: string }
  | { readonly compare: StrategyExpression; readonly op: 'lt' | 'le' | 'eq' | 'ge' | 'gt'; readonly to: StrategyExpression };

export type StrategyTarget = { readonly target: string } | { readonly param: string };

export interface StrategyBet {
  readonly target: StrategyTarget;
  readonly amount: StrategyExpression;
  readonly cap?: string;
}

export interface StrategyInstruction {
  readonly id: string;
  readonly label: string;
  readonly when: StrategyCondition;
  readonly priority?: number;
  readonly overrides?: readonly string[];
  readonly bets: readonly StrategyBet[];
  readonly note?: string;
}

export interface StrategyParameter {
  readonly id: string;
  readonly label: string;
  readonly choices: readonly string[];
  readonly default: string;
  readonly distinctFrom?: string;
}

export interface StrategyCounter {
  readonly id: string;
  readonly initial: string;
  readonly cap?: string;
}

export interface StrategyList {
  readonly id: string;
  readonly initial: readonly string[];
}

interface AdjustmentBase {
  readonly id: string;
  readonly on: 'win' | 'loss' | 'push' | 'any';
  readonly wager?: string;
}

export type StrategyAdjustment =
  | (AdjustmentBase & { readonly counter: string; readonly to: StrategyExpression })
  | (AdjustmentBase & { readonly list: string; readonly append: StrategyExpression })
  | (AdjustmentBase & { readonly list: string; readonly drop: 'ends' });

export interface StrategyDefinition {
  readonly format: typeof STRATEGY_FORMAT;
  readonly id: string;
  readonly revision: number;
  readonly name: string;
  readonly game: string;
  readonly table: unknown;
  readonly parameters: readonly StrategyParameter[];
  readonly counters: readonly StrategyCounter[];
  readonly lists?: readonly StrategyList[];
  readonly instructions: readonly StrategyInstruction[];
  readonly adjustments: readonly StrategyAdjustment[];
  readonly stopWhen: StrategyCondition | null;
  readonly play?: unknown;
  readonly completeWhen?: StrategyCondition | null;
  readonly note?: string;
}

export interface StrategySelection {
  readonly definition: StrategyDefinition;
  readonly parameters: Readonly<Record<string, string>>;
}

export const defaultSelection = (definition: StrategyDefinition): StrategySelection => ({
  definition,
  parameters: Object.fromEntries(definition.parameters.map((param) => [param.id, param.default])),
});

export type DiagnosticCategory = 'incomplete' | 'conflict' | 'incompatible' | 'envelope' | 'unbounded';

export interface StrategyDiagnostic {
  readonly category: DiagnosticCategory;
  readonly path: string;
  readonly message: string;
}

export interface StrategyValidation {
  readonly diagnostics: readonly StrategyDiagnostic[];
  // Spec 1 Amendment 7
  readonly runnable: boolean;
}

export type BetRequirement =
  | 'not-on-layout'
  | 'not-whole-units'
  | 'below-minimum'
  | 'above-maximum'
  | 'stake-increment'
  | 'not-available-now'
  | 'committed-wager'
  | 'odds-increment'
  | 'above-odds-cap';

export interface StrategyVocabulary<Situation = unknown> {
  readonly game: string;
  readonly subjects: Readonly<Record<string, readonly string[]>>;
  readonly values?: readonly string[];
  value?(situation: Situation, name: string): Money;
  tableProblems(table: unknown): readonly { readonly path: string; readonly message: string }[];
  betRequirement(table: unknown, target: string, amount: Money): { readonly requirement: BetRequirement; readonly limit?: string } | undefined;
  tableMismatch(declared: unknown, actual: unknown): readonly { readonly path: string; readonly requirement: string }[];
  situationProblem(situation: unknown): string | undefined;
  tableOf(situation: Situation): unknown;
  available(situation: Situation): Money;
  subject(situation: Situation, name: string): string;
  readonly overrideEndsCycle?: boolean;
  playProblems?(play: unknown, table: unknown): readonly { readonly path: string; readonly message: string; readonly category?: DiagnosticCategory }[];
}

export interface PlayAssessment<Explanation = unknown, Move = unknown, Command = unknown> {
  readonly explanation: Explanation;
  readonly actual: Move;
  readonly follows: boolean;
  readonly prescribed: Command;
}

export interface StrategyGame<State = never> {
  readonly vocabulary: StrategyVocabulary;
  tableForRules(rules: unknown): unknown;
  situation(state: State): unknown;
  assessPlay?(state: State, definition: StrategyDefinition, command: unknown): PlayAssessment | undefined;
  playCommand?(move: unknown): Command;
  followPlay?(state: State, definition: StrategyDefinition): Command | undefined;
  outcome(state: State): string;
  hidesPending?(state: State): boolean;
}

export interface StrategyProgress {
  readonly counters: Readonly<Record<string, string>>;
  readonly lists: Readonly<Record<string, readonly string[]>>;
  readonly lastResult: TurnResult;
  readonly cycleTurn: number;
}

export type PauseReason = 'unfunded-group' | 'limit' | 'cap' | 'stop';

export interface PrescribedBet {
  readonly target: string;
  readonly amount: string;
}

export interface HeldGroup {
  readonly instruction: string;
  readonly reason: PauseReason;
  readonly unavailable: readonly PrescribedBet[];
  readonly cap?: string;
}

export type Prescription =
  | { readonly status: 'prescribed'; readonly bets: readonly PrescribedBet[]; readonly held: readonly HeldGroup[] }
  | { readonly status: 'paused'; readonly reason: PauseReason; readonly unavailable: readonly PrescribedBet[]; readonly cap?: string }
  | { readonly status: 'uncovered' };

export interface Explanation {
  readonly situation: {
    readonly available: string;
    readonly subjects: Readonly<Record<string, string>>;
    readonly values: Readonly<Record<string, string>>;
  };
  readonly instructions: readonly { readonly id: string; readonly label: string }[];
  readonly prescription: Prescription;
  readonly fallback: 'no-new-bets' | null;
  readonly state: StrategyProgress;
}

const isText = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 128;
const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

function utf8Bytes(text: string): number {
  let bytes = 0;
  for (const char of text) {
    const code = char.codePointAt(0) as number;
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return bytes;
}

const MAX_WALK_DEPTH = 64;

const ZERO = money(0n);

interface Checker {
  readonly diagnostics: StrategyDiagnostic[];
  nodes: number;
  readonly counters: ReadonlySet<string>;
  readonly lists: ReadonlySet<string>;
  readonly values: ReadonlySet<string>;
}

const listRead = (id: string) => `list:${id}`;
const STAKED_READ = 'staked:';

const report = (checker: Checker, category: DiagnosticCategory, path: string, message: string) => {
  checker.diagnostics.push({ category, path, message });
};

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

type ExpressionPlace = 'amount' | 'adjustment' | 'condition';

function checkExpression(checker: Checker, value: unknown, path: string, depth: number, reads: Set<string>, place: ExpressionPlace = 'amount'): boolean {
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
    case 'first':
    case 'last':
    case 'length':
      if (!checker.lists.has(operand as string)) return report(checker, 'incomplete', path, `no list ${String(operand)}`), false;
      reads.add(listRead(operand as string));
      return true;
    case 'staked':
      if (operand !== true || place !== 'adjustment') return report(checker, 'incomplete', path, 'only an adjustment can read what the turn staked'), false;
      reads.add(STAKED_READ);
      return true;
    case 'value':
      if (typeof operand !== 'string' || !checker.values.has(operand)) return report(checker, 'incomplete', path, `no situation value ${String(operand)}`), false;
      if (place !== 'condition') return report(checker, 'incomplete', path, 'only a condition can read a situation value'), false;
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
      for (const [index, item] of operand.entries()) ok = checkExpression(checker, item, `${path}/${key}/${index}`, depth + 1, reads, place) && ok;
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
    const values = subject === 'last-result' ? RESULTS : Object.hasOwn(vocabulary.subjects, subject) ? vocabulary.subjects[subject] : undefined;
    if (Object.keys(value).length !== 2 || !values) return report(checker, 'incomplete', path, `unknown subject ${String(value.subject)}`), false;
    if (!values.includes(value.is as string)) return report(checker, 'incomplete', `${path}/is`, `${String(value.subject)} is never ${String(value.is)}`), false;
    return true;
  }
  if ('compare' in value) {
    if (Object.keys(value).length !== 3 || !COMPARISONS.includes(value.op as string)) return report(checker, 'incomplete', path, 'a comparison needs compare, op and to'), false;
    const reads = new Set<string>();
    const left = checkExpression(checker, value.compare, `${path}/compare`, 0, reads, 'condition');
    return checkExpression(checker, value.to, `${path}/to`, 0, reads, 'condition') && left;
  }
  return report(checker, 'incomplete', path, 'unknown condition'), false;
}

const RESULTS: readonly TurnResult[] = ['win', 'loss', 'push', 'none'];

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
  const listIds = new Set<string>();
  const checker: Checker = { diagnostics, nodes: 0, counters: counterIds, lists: listIds, values: new Set(vocabulary.values ?? []) };
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

  const hasPlay = 'play' in def;
  if (hasPlay) {
    if (!vocabulary.playProblems) flag('incomplete', '/play', `${vocabulary.game} strategies have no playing policy`);
    else if (tableOk) for (const problem of vocabulary.playProblems(def.play, def.table)) flag(problem.category ?? 'incomplete', problem.path, problem.message);
  }

  const lists = def.lists === undefined ? [] : Array.isArray(def.lists) ? def.lists : (flag('incomplete', '/lists', 'lists are a list'), []);
  for (const [index, list] of lists.entries()) {
    const path = `/lists/${index}`;
    if (!isRecord(list) || !isText(list.id) || !Array.isArray(list.initial)) {
      flag('incomplete', path, 'a list needs an id and its initial items');
      continue;
    }
    if (listIds.has(list.id)) flag('incomplete', `${path}/id`, `list ${list.id} is declared twice`);
    listIds.add(list.id);
    if (list.initial.length > STRATEGY_ENVELOPE.listItems) flag('envelope', `${path}/initial`, `a list holds at most ${STRATEGY_ENVELOPE.listItems} items`);
    else for (const [item, value] of list.initial.entries()) literal(checker, value, `${path}/initial/${item}`);
  }

  const instructions = Array.isArray(def.instructions) ? def.instructions : [];
  if (!Array.isArray(def.instructions) || (instructions.length === 0 && !hasPlay)) flag('incomplete', '/instructions', 'a strategy needs at least one instruction');
  if (instructions.length > STRATEGY_ENVELOPE.instructions) {
    flag('envelope', '/instructions', `a strategy has at most ${STRATEGY_ENVELOPE.instructions} instructions`);
    return done();
  }
  const instructionIds = new Set<string>();
  const betReads: { reads: ReadonlySet<string>; capped: boolean }[] = [];
  const usable:{ index: number; id: string; priority: number | null; overrides: string[]; when: StrategyCondition; targets: Set<string>[] }[] = [];
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
      const capOk = bet.cap !== undefined && literal(checker, bet.cap, `${betPath}/cap`) !== undefined;
      betReads.push({ reads, capped: capOk });
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
      if (amountOk && possible && tableOk && reads.size === 0) {
        const amount = evaluate(bet.amount as StrategyExpression, NO_VALUES);
        for (const choice of possible) {
          const failed = amount && vocabulary.betRequirement(def.table, choice, amount);
          if (failed && failed.requirement !== 'not-on-layout') {
            flag('incompatible', `${betPath}/amount`, `${encodeMoney(amount)} on ${choice} fails the declared table (${failed.requirement})`);
            break;
          }
        }
      }
    }
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

  const overridesOf = new Map(usable.map((item) => [item.id, item.overrides]));
  const inCircle = (start: string): boolean => {
    const seen = new Set<string>();
    const stack = [...(overridesOf.get(start) ?? [])];
    while (stack.length > 0) {
      const id = stack.pop() as string;
      if (id === start) return true;
      if (seen.has(id)) continue;
      seen.add(id);
      stack.push(...(overridesOf.get(id) ?? []));
    }
    return false;
  };
  const circular = usable.filter((item) => inCircle(item.id));
  const lastCircular = circular.at(-1);
  if (lastCircular) {
    flag('conflict', `/instructions/${lastCircular.index}`, `instructions ${circular.map((item) => item.id).join(', ')} override each other in a circle; none can win`);
  }

  for (let a = 0; a < usable.length; a++) {
    for (let b = a + 1; b < usable.length; b++) {
      const [x, y] = [usable[a], usable[b]] as [(typeof usable)[number], (typeof usable)[number]];
      const share = x.targets.some((tx) => y.targets.some((ty) => overlaps(tx, ty)));
      if (!share || ranked(x, y) !== 0 || disjoint(x.when, y.when)) continue;
      flag('conflict', `/instructions/${y.index}`, `instructions ${x.id} and ${y.id} may both prescribe the same bet; give one a priority or an exception`);
    }
  }

  const adjustments = Array.isArray(def.adjustments) ? def.adjustments : (flag('incomplete', '/adjustments', 'adjustments are a list'), []);
  const grows = new Set<string>();
  const feeds = new Map<string, Set<string>>();
  for (const [index, item] of adjustments.entries()) {
    const path = `/adjustments/${index}`;
    if (!isRecord(item) || !isText(item.id) || !['win', 'loss', 'push', 'any'].includes(item.on as string)) {
      flag('incomplete', path, 'an adjustment needs an id, a result and a counter or list');
      continue;
    }
    const reads = new Set<string>();
    if ('wager' in item) {
      if (!isText(item.wager)) flag('incomplete', `${path}/wager`, 'a wager names a target');
      else if (tableOk && vocabulary.betRequirement(def.table, item.wager, money(1n))?.requirement === 'not-on-layout') {
        flag('incompatible', `${path}/wager`, `${item.wager} isn't a bet under the declared table conditions`);
      }
    }
    if ('list' in item) {
      const keys = Object.keys(item).filter((key) => key !== 'wager').sort().join();
      if (!listIds.has(item.list as string)) {
        flag('incomplete', `${path}/list`, `no list ${String(item.list)}`);
      } else if (keys === 'drop,id,list,on') {
        if (item.drop !== 'ends') flag('incomplete', `${path}/drop`, 'a list drops its ends');
      } else if (keys === 'append,id,list,on') {
        if (checkExpression(checker, item.append, `${path}/append`, 0, reads, 'adjustment')) grows.add(listRead(item.list as string));
      } else {
        flag('incomplete', path, 'a list adjustment appends an amount or drops the ends');
      }
      continue;
    }
    if (!counterIds.has(item.counter as string)) {
      flag('incomplete', `${path}/counter`, `no counter ${String(item.counter)}`);
      continue;
    }
    if (checkExpression(checker, item.to, `${path}/to`, 0, reads, 'adjustment')) {
      const fed = feeds.get(item.counter as string) ?? new Set<string>();
      for (const read of reads) fed.add(read);
      feeds.set(item.counter as string, fed);
    }
  }
  feeds.set(STAKED_READ, new Set(betReads.flatMap((bet) => [...bet.reads])));
  for (const counter of feeds.keys()) {
    if (counter === STAKED_READ) continue;
    const seen = new Set<string>();
    const stack = [...(feeds.get(counter) ?? [])];
    while (stack.length > 0) {
      const read = stack.pop() as string;
      if (read === counter) {
        grows.add(counter);
        break;
      }
      if (seen.has(read)) continue;
      seen.add(read);
      stack.push(...(feeds.get(read) ?? []));
    }
  }

  const stopOk = def.stopWhen === null || checkCondition(checker, vocabulary, def.stopWhen, '/stopWhen', 0);
  if (!stopOk && def.stopWhen === undefined) flag('incomplete', '/stopWhen', 'stopWhen is a condition or null');
  if (def.completeWhen !== undefined && def.completeWhen !== null) checkCondition(checker, vocabulary, def.completeWhen, '/completeWhen', 0);

  const bounded = (read: string) => {
    const sized = betReads.filter((bet) => bet.reads.has(read));
    return def.stopWhen !== null || (sized.length > 0 && sized.every((bet) => bet.capped));
  };
  for (const [index, counter] of counters.entries()) {
    if (isRecord(counter) && grows.has(counter.id as string) && !capped.has(counter.id as string) && !bounded(counter.id as string)) {
      flag('unbounded', `/counters/${index}`, `counter ${String(counter.id)} can grow without a declared cap or stop`);
    }
  }
  for (const [index, list] of lists.entries()) {
    if (isRecord(list) && grows.has(listRead(list.id as string)) && !bounded(listRead(list.id as string))) {
      flag('unbounded', `/lists/${index}`, `list ${String(list.id)} can grow without a declared cap or stop`);
    }
  }

  if (checker.nodes > STRATEGY_ENVELOPE.expressionNodes) {
    flag('envelope', '/', `a strategy has at most ${STRATEGY_ENVELOPE.expressionNodes} expression and condition nodes`);
  }
  if (configuration !== undefined && diagnostics.length === 0) {
    const problem = parameterProblem(def as unknown as StrategyDefinition, configuration);
    if (problem) flag('incomplete', '/parameters', problem);
  }
  return done();
}

const overlaps = (a: ReadonlySet<string>, b: ReadonlySet<string>) => [...a].some((item) => b.has(item));

const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

const resolveTarget = (target: StrategyTarget, parameters: Readonly<Record<string, string>>): string =>
  'target' in target ? target.target : (parameters[target.param] as string);

function ranked(x: { id: string; priority: number | null; overrides: readonly string[] }, y: { id: string; priority: number | null; overrides: readonly string[] }): number {
  if (x.overrides.includes(y.id)) return 1;
  if (y.overrides.includes(x.id)) return -1;
  if (x.priority !== null && y.priority === null) return 1;
  if (x.priority === null && y.priority !== null) return -1;
  if (x.priority !== null && y.priority !== null) return x.priority - y.priority;
  return 0;
}

function requiredTests(condition: StrategyCondition): { subject: string; is: string }[] {
  if ('subject' in condition) return [condition];
  if ('all' in condition) return condition.all.flatMap(requiredTests);
  return [];
}

function disjoint(a: StrategyCondition, b: StrategyCondition): boolean {
  if ('any' in a) return a.any.every((item) => disjoint(item, b));
  if ('any' in b) return b.any.every((item) => disjoint(a, item));
  const left = requiredTests(a);
  return requiredTests(b).some((r) => left.some((l) => l.subject === r.subject && l.is !== r.is));
}

interface Values {
  readonly counters: Readonly<Record<string, string>>;
  readonly lists: Readonly<Record<string, readonly string[]>>;
  readonly staked?: Money;
  readonly situation?: Readonly<Record<string, Money>>;
}

const NO_VALUES: Values = { counters: {}, lists: {} };

function evaluate(expression: StrategyExpression, values: Values): Money | undefined {
  const value = ((): Money | undefined => {
    if ('lit' in expression) return decodeStrategyLiteral(expression.lit);
    if ('counter' in expression) return decodeMoney(values.counters[expression.counter] as string);
    if ('first' in expression || 'last' in expression) {
      const items = values.lists['first' in expression ? expression.first : expression.last] as readonly string[];
      const item = 'first' in expression ? items[0] : items.at(-1);
      return item === undefined ? undefined : decodeMoney(item);
    }
    if ('length' in expression) return money(BigInt((values.lists[expression.length] as readonly string[]).length));
    if ('staked' in expression) return values.staked ?? ZERO;
    if ('value' in expression) return values.situation?.[expression.value];
    const operands = 'add' in expression ? expression.add : 'sub' in expression ? expression.sub : 'mul' in expression ? expression.mul : 'min' in expression ? expression.min : expression.max;
    const results: Money[] = [];
    for (const operand of operands) {
      const v = evaluate(operand, values);
      if (!v) return undefined;
      results.push(v);
    }
    const [first, second] = results as [Money, Money];
    if ('add' in expression) return add(first, second);
    if ('sub' in expression) return sub(first, second);
    if ('mul' in expression) return mul(first, second);
    const pick = 'min' in expression ? -1 : 1;
    return results.reduce((best, v) => (compare(v, best) === pick ? v : best));
  })();
  return value && withinStrategyBits(value) ? value : undefined;
}

const expressionReads = (expression: StrategyExpression, name: string): boolean => {
  if ('value' in expression) return expression.value === name;
  const operands = 'add' in expression ? expression.add : 'sub' in expression ? expression.sub : 'mul' in expression ? expression.mul : 'min' in expression ? expression.min : 'max' in expression ? expression.max : [];
  return operands.some((operand) => expressionReads(operand, name));
};

export function instructionsRead(definition: StrategyDefinition, name: string): boolean {
  const reads = (condition: StrategyCondition): boolean =>
    'all' in condition ? condition.all.some(reads) : 'any' in condition ? condition.any.some(reads) : 'compare' in condition ? expressionReads(condition.compare, name) || expressionReads(condition.to, name) : false;
  return definition.instructions.some((instruction) => reads(instruction.when));
}

const situationValues = <S>(vocabulary: StrategyVocabulary<S>, situation: S): Record<string, Money> =>
  Object.fromEntries((vocabulary.values ?? []).map((name) => [name, (vocabulary.value as NonNullable<StrategyVocabulary<S>['value']>)(situation, name)]));

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
  const values = { ...progress, situation: situationValues(vocabulary, situation) };
  const left = evaluate(condition.compare, values);
  const right = evaluate(condition.to, values);
  if (!left || !right) return undefined;
  const order = compare(left, right);
  return { lt: order < 0, le: order <= 0, eq: order === 0, ge: order >= 0, gt: order > 0 }[condition.op];
}

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

export const initialProgress = (definition: StrategyDefinition): StrategyProgress => ({
  counters: Object.fromEntries(definition.counters.map((counter) => [counter.id, encodeMoney(decodeStrategyLiteral(counter.initial))])),
  lists: Object.fromEntries((definition.lists ?? []).map((list) => [list.id, list.initial.map((item) => encodeMoney(decodeStrategyLiteral(item)))])),
  lastResult: 'none',
  cycleTurn: 0,
});

function isStrategyValue(value: unknown): boolean {
  try {
    return typeof value === 'string' && value.length <= 200 && encodeMoney(decodeMoney(value)) === value && withinStrategyBits(decodeMoney(value));
  } catch {
    return false;
  }
}

const sameIds = (record: Record<string, unknown>, ids: readonly string[]) => Object.keys(record).sort().join() === [...ids].sort().join();

export function progressProblem(definition: StrategyDefinition, progress: unknown): string | undefined {
  if (!hasExactKeys(progress, ['counters', 'lists', 'lastResult', 'cycleTurn'])) return 'damaged strategy progress';
  if (!RESULTS.includes(progress.lastResult as TurnResult) || !isCount(progress.cycleTurn)) return 'damaged strategy progress';
  const { counters, lists } = progress;
  if (!isRecord(counters) || !sameIds(counters, definition.counters.map((c) => c.id))) return 'damaged strategy counters';
  if (!Object.values(counters).every(isStrategyValue)) return 'damaged strategy counters';
  if (!isRecord(lists) || !sameIds(lists, (definition.lists ?? []).map((l) => l.id))) return 'damaged strategy lists';
  for (const items of Object.values(lists)) {
    if (!Array.isArray(items) || items.length > STRATEGY_ENVELOPE.listItems || !items.every(isStrategyValue)) return 'damaged strategy lists';
  }
  return undefined;
}

export function prescribe<S>(vocabulary: StrategyVocabulary<S>, { definition, parameters }: StrategySelection, situation: S, progress: StrategyProgress): Explanation {
  const available = vocabulary.available(situation);
  const subjects: Record<string, string> = { 'last-result': progress.lastResult };
  for (const name of Object.keys(vocabulary.subjects).sort()) subjects[name] = vocabulary.subject(situation, name);
  const values = Object.fromEntries(Object.entries(situationValues(vocabulary, situation)).map(([name, value]) => [name, encodeMoney(value)]));
  const base = { situation: { available: encodeMoney(available), subjects, values }, state: progress };
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
  const winners = matching.filter((instruction) =>
    !matching.some((other) => other !== instruction && overlaps(targetsOf(instruction), targetsOf(other)) && ranked(meta(other), meta(instruction)) > 0),
  );
  if (winners.length === 0) return { ...base, instructions: [], prescription: { status: 'uncovered' }, fallback: 'no-new-bets' };
  winners.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || byText(a.id, b.id));
  const named = winners.map((instruction) => ({ id: instruction.id, label: instruction.label }));

  const table = vocabulary.tableOf(situation);
  const bets: PrescribedBet[] = [];
  const held: HeldGroup[] = [];
  let remaining = available;
  for (const instruction of winners) {
    const group: PrescribedBet[] = [];
    let overCap = false;
    let cap: string | undefined;
    for (const bet of instruction.bets) {
      const amount = evaluate(bet.amount, progress);
      if (!amount) overCap = true;
      else if (bet.cap !== undefined && compare(amount, decodeStrategyLiteral(bet.cap)) > 0) {
        overCap = true;
        cap ??= encodeMoney(decodeStrategyLiteral(bet.cap));
      }
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
      held.push({ instruction: instruction.id, reason, unavailable: group, ...(cap === undefined ? {} : { cap }) });
    } else {
      bets.push(...group);
      remaining = sub(remaining, total);
    }
  }
  bets.sort((a, b) => byText(a.target, b.target));
  if (bets.length === 0) {
    const first = held[0] as HeldGroup;
    const unavailable = held.flatMap((group) => group.unavailable).sort((a, b) => byText(a.target, b.target));
    const prescription: Prescription = { status: 'paused', reason: first.reason, unavailable, ...(first.cap === undefined ? {} : { cap: first.cap }) };
    return { ...base, instructions: named, prescription, fallback: 'no-new-bets' };
  }
  return { ...base, instructions: named, prescription: { status: 'prescribed', bets, held }, fallback: held.length > 0 ? 'no-new-bets' : null };
}

export function progressAfter(
  definition: StrategyDefinition,
  progress: StrategyProgress,
  result: Exclude<TurnResult, 'none'>,
  staked: Money,
  wagers: Readonly<Record<string, TurnResult>> = {},
): StrategyProgress | undefined {
  const counters: Record<string, string> = { ...progress.counters };
  const lists: Record<string, readonly string[]> = { ...progress.lists };
  const before: Values = { ...progress, staked };
  for (const adjustment of definition.adjustments) {
    const own = adjustment.wager === undefined ? result : Object.hasOwn(wagers, adjustment.wager) ? wagers[adjustment.wager] : undefined;
    if (own === undefined || (adjustment.on !== 'any' && adjustment.on !== own)) continue;
    if ('drop' in adjustment) {
      lists[adjustment.list] = (lists[adjustment.list] as readonly string[]).slice(1, -1);
      continue;
    }
    const value = evaluate('append' in adjustment ? adjustment.append : adjustment.to, before);
    if (!value) return undefined;
    if ('append' in adjustment) {
      const items = [...(lists[adjustment.list] as readonly string[]), encodeMoney(value)];
      if (items.length > STRATEGY_ENVELOPE.listItems) return undefined;
      lists[adjustment.list] = items;
    } else {
      counters[adjustment.counter] = encodeMoney(value);
    }
  }
  return { counters, lists, lastResult: result, cycleTurn: progress.cycleTurn + 1 };
}

export function cycleComplete<S>(vocabulary: StrategyVocabulary<S>, definition: StrategyDefinition, situation: S, progress: StrategyProgress): boolean {
  return definition.completeWhen != null && holds(vocabulary, definition.completeWhen, situation, progress) === true;
}

export interface TableRequirement {
  readonly path: string;
  readonly requirement: string;
  readonly target?: string;
  readonly amount?: string;
  readonly limit?: string;
}

export function compatibilityWith(vocabulary: StrategyVocabulary, definition: StrategyDefinition, parameters: unknown, table: unknown): TableRequirement[] {
  const problem = parameterProblem(definition, parameters);
  if (problem) return [{ path: '/parameters', requirement: 'invalid-parameter' }];
  const chosen = parameters as Readonly<Record<string, string>>;
  const requirements: TableRequirement[] = [...vocabulary.tableMismatch(definition.table, table)];
  if (requirements.length > 0) return requirements;
  const start = initialProgress(definition);
  for (const [index, instruction] of definition.instructions.entries()) {
    for (const [betIndex, bet] of instruction.bets.entries()) {
      const target = resolveTarget(bet.target, chosen);
      const amount = evaluate(bet.amount, start);
      if (!amount) continue;
      const failed = vocabulary.betRequirement(table, target, amount);
      if (!failed) continue;
      const path = `/instructions/${index}/bets/${betIndex}/${failed.requirement === 'not-on-layout' ? 'target' : 'amount'}`;
      requirements.push({ path, target, amount: encodeMoney(amount), requirement: failed.requirement, ...(failed.limit === undefined ? {} : { limit: failed.limit }) });
    }
  }
  return requirements;
}
