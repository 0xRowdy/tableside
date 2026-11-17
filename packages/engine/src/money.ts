export interface Money {
  readonly n: bigint;
  readonly d: bigint;
}

export class MoneyFormatError extends Error {
  constructor(text: string) {
    super(`not a canonical money value: ${JSON.stringify(text.length > 64 ? `${text.slice(0, 64)}…` : text)}`);
    this.name = 'MoneyFormatError';
  }
}

function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b;
  while (y !== 0n) [x, y] = [y, x % y];
  return x;
}

export function money(n: bigint, d = 1n): Money {
  if (d === 0n) throw new RangeError('money denominator must not be zero');
  if (d < 0n) [n, d] = [-n, -d];
  if (n === 0n) return { n: 0n, d: 1n };
  const g = gcd(n, d);
  return g === 1n ? { n, d } : { n: n / g, d: d / g };
}

export const add = (a: Money, b: Money): Money => money(a.n * b.d + b.n * a.d, a.d * b.d);
export const sub = (a: Money, b: Money): Money => money(a.n * b.d - b.n * a.d, a.d * b.d);
export const mul = (a: Money, b: Money): Money => money(a.n * b.n, a.d * b.d);
export const neg = (a: Money): Money => money(-a.n, a.d);

export function div(a: Money, b: Money): Money {
  if (b.n === 0n) throw new RangeError('cannot divide money by zero');
  return money(a.n * b.d, a.d * b.n);
}

export function compare(a: Money, b: Money): -1 | 0 | 1 {
  const left = a.n * b.d;
  const right = b.n * a.d;
  return left < right ? -1 : left > right ? 1 : 0;
}

export function encodeMoney(value: Money): string {
  return value.d === 1n ? value.n.toString() : `${value.n.toString()}/${value.d.toString()}`;
}

const CANONICAL = /^(-?)(0|[1-9][0-9]*)(?:\/([1-9][0-9]*))?$/;

export function decodeMoney(text: string): Money {
  const match = typeof text === 'string' ? CANONICAL.exec(text) : null;
  if (!match) throw new MoneyFormatError(String(text));
  const [, sign, numerator, denominator] = match;
  const n = BigInt(numerator as string);
  const d = denominator === undefined ? 1n : BigInt(denominator);
  const canonical =
    n === 0n ? sign === '' && denominator === undefined : denominator === undefined || (d !== 1n && gcd(n, d) === 1n);
  if (!canonical) throw new MoneyFormatError(text);
  return { n: sign === '-' ? -n : n, d };
}

export function commission(basis: Money, rate: Money): Money {
  if (basis.n <= 0n || rate.n <= 0n) throw new RangeError('commission needs a positive basis and rate');
  const exact = mul(basis, rate);
  const ceiling = (exact.n + exact.d - 1n) / exact.d;
  return money(ceiling < 1n ? 1n : ceiling);
}
