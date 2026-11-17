// Spec 1 Amendment 6 §3

import { canonicalJson } from './canonical';
import { add, decodeMoney, encodeMoney, money, mul, sub, compare, type Money } from './money';
import { RANDOM_PROTOCOL_VERSION } from './random';
import { sha256Hex } from './sha256';
import { isRecord, type VersionedIdentity } from './shape';
import { validateStrategy } from './strategies';
import {
  parameterProblem,
  STRATEGY_FORMAT,
  type StrategyAdjustment,
  type StrategyBet,
  type StrategyCondition,
  type StrategyExpression,
  type StrategyInstruction,
  type StrategySelection,
} from './strategy';
import type { BenchmarkProfile } from './standardized';
import { ENGINE_VERSION } from './version';

export const CANONICAL_ENCODING = { version: 1, instructionSchema: STRATEGY_FORMAT, normalization: 1 } as const;

export class FingerprintIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FingerprintIntegrityError';
  }
}

export interface CanonicalSpecification {
  readonly manifest: string;
  readonly fingerprint: string;
}

function number(text: string): Money | undefined {
  const match = /^([+-]?)([0-9]+)(?:\.([0-9]+))?(?:\/([0-9]+))?$/.exec(text);
  if (!match) return undefined;
  const [, sign, whole, fraction = '', denominator] = match;
  const scale = 10n ** BigInt(fraction.length);
  const d = BigInt(denominator ?? '1');
  if (d === 0n) return undefined;
  const value = money(BigInt(`${whole as string}${fraction}`), scale * d);
  return sign === '-' ? money(-value.n, value.d) : value;
}

const canonicalNumber = (text: string): string => {
  const value = number(text);
  return value === undefined ? text : encodeMoney(value);
};

function table(value: unknown): unknown {
  if (typeof value === 'string') return canonicalNumber(value);
  if (Array.isArray(value)) return value.map(table);
  if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, table(item)]));
  return value;
}

interface Names {
  readonly counters: ReadonlyMap<string, string>;
  readonly lists: ReadonlyMap<string, string>;
  readonly instructions: ReadonlyMap<string, string>;
  readonly parameters: Readonly<Record<string, string>>;
}

const renamed = (map: ReadonlyMap<string, string>, id: string) => map.get(id) ?? id;

const FOLD: Readonly<Record<'add' | 'sub' | 'mul', (a: Money, b: Money) => Money>> = { add, sub, mul };

function expression(value: StrategyExpression, names: Names): StrategyExpression {
  if ('lit' in value) return { lit: canonicalNumber(value.lit) };
  if ('counter' in value) return { counter: renamed(names.counters, value.counter) };
  if ('first' in value) return { first: renamed(names.lists, value.first) };
  if ('last' in value) return { last: renamed(names.lists, value.last) };
  if ('length' in value) return { length: renamed(names.lists, value.length) };
  if ('staked' in value || 'value' in value) return value;
  const literal = (items: readonly StrategyExpression[]) => (items.every((item) => 'lit' in item) ? items.map((item) => decodeMoney((item as { lit: string }).lit)) : undefined);
  for (const op of ['add', 'sub', 'mul'] as const) {
    if (op in value) {
      const [a, b] = (value as Record<typeof op, readonly [StrategyExpression, StrategyExpression]>)[op];
      const items: [StrategyExpression, StrategyExpression] = [expression(a, names), expression(b, names)];
      const folded = literal(items);
      return folded ? { lit: encodeMoney(FOLD[op](folded[0] as Money, folded[1] as Money)) } : ({ [op]: items } as unknown as StrategyExpression);
    }
  }
  if (!('min' in value) && !('max' in value)) throw new FingerprintIntegrityError('unknown expression node');
  const op = 'min' in value ? 'min' : 'max';
  const items = (value as Record<typeof op, readonly StrategyExpression[]>)[op].map((item) => expression(item, names));
  const folded = literal(items);
  if (!folded) return { [op]: items } as unknown as StrategyExpression;
  const pick = folded.reduce((a, b) => (compare(a, b) === (op === 'min' ? 1 : -1) ? b : a));
  return { lit: encodeMoney(pick) };
}

function condition(value: StrategyCondition, names: Names): StrategyCondition {
  if ('always' in value) return value;
  if ('all' in value) return { all: value.all.map((item) => condition(item, names)) };
  if ('any' in value) return { any: value.any.map((item) => condition(item, names)) };
  if ('subject' in value) return { subject: value.subject, is: value.is };
  if (!('compare' in value)) throw new FingerprintIntegrityError('unknown condition node');
  return { compare: expression(value.compare, names), op: value.op, to: expression(value.to, names) };
}

const bet = (value: StrategyBet, names: Names) => ({
  target: 'param' in value.target ? (names.parameters[value.target.param] as string) : value.target.target,
  amount: expression(value.amount, names),
  cap: value.cap === undefined ? null : canonicalNumber(value.cap),
});

const instruction = (value: StrategyInstruction, names: Names) => ({
  when: condition(value.when, names),
  priority: value.priority ?? null,
  overrides: (value.overrides ?? []).map((id) => renamed(names.instructions, id)).sort(),
  bets: value.bets.map((item) => bet(item, names)),
});

function adjustment(value: StrategyAdjustment, names: Names) {
  const base = { on: value.on, wager: value.wager ?? null };
  if ('counter' in value) return { ...base, counter: renamed(names.counters, value.counter), to: expression(value.to, names) };
  if ('append' in value) return { ...base, list: renamed(names.lists, value.list), append: expression(value.append, names) };
  return { ...base, list: renamed(names.lists, value.list), drop: value.drop };
}

function play(value: unknown): unknown {
  if (!isRecord(value) || !Array.isArray(value.deviations)) return value ?? null;
  const teaching = new Set(['id', 'situation', 'published']);
  const deviations = (value.deviations as unknown[]).map((item) => (isRecord(item) ? Object.fromEntries(Object.entries(item).filter(([key]) => !teaching.has(key))) : item));
  return { ...value, deviations };
}

export function canonicalStrategy({ definition, parameters: chosen }: StrategySelection): unknown {
  const validation = validateStrategy(definition);
  if (!validation.runnable) throw new FingerprintIntegrityError(`the strategy is not runnable: ${validation.diagnostics.map((d) => `${d.category} ${d.path}`).join('; ')}`);
  const problem = parameterProblem(definition, chosen);
  if (problem) throw new FingerprintIntegrityError(problem);
  const position = (prefix: string, items: readonly { readonly id: string }[]) => new Map(items.map((item, index) => [item.id, `${prefix}${index}`]));
  const names: Names = {
    counters: position('c', definition.counters),
    lists: position('l', definition.lists ?? []),
    instructions: position('i', definition.instructions),
    parameters: chosen,
  };
  return {
    format: definition.format,
    game: definition.game,
    table: table(definition.table),
    counters: definition.counters.map((counter) => ({ initial: canonicalNumber(counter.initial), cap: counter.cap === undefined ? null : canonicalNumber(counter.cap) })),
    lists: (definition.lists ?? []).map((list) => list.initial.map(canonicalNumber)),
    instructions: definition.instructions.map((item) => instruction(item, names)),
    adjustments: definition.adjustments.map((item) => adjustment(item, names)),
    stopWhen: definition.stopWhen === null ? null : condition(definition.stopWhen, names),
    completeWhen: definition.completeWhen == null ? null : condition(definition.completeWhen, names),
    play: play(definition.play),
  };
}

export function canonicalSpecification(input: {
  readonly strategy: StrategySelection;
  readonly profile: BenchmarkProfile;
  readonly analysis: VersionedIdentity;
}): CanonicalSpecification {
  const { profile } = input;
  const manifest = canonicalJson({
    encoding: CANONICAL_ENCODING,
    strategy: canonicalStrategy(input.strategy),
    profile,
    identities: {
      engine: ENGINE_VERSION,
      rules: { id: profile.rules.id, version: profile.rules.version },
      reference: profile.reference,
      randomProtocol: RANDOM_PROTOCOL_VERSION,
      analysis: { id: input.analysis.id, version: input.analysis.version },
    },
  });
  return { manifest, fingerprint: sha256Hex(manifest) };
}

export function verifySpecification(specification: CanonicalSpecification): void {
  if (sha256Hex(specification.manifest) !== specification.fingerprint) {
    throw new FingerprintIntegrityError('the fingerprint does not match its manifest');
  }
}
