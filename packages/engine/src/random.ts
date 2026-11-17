// docs/decisions/mobile-platform-shared-game-engine.md Reproducible random protocol

import { philox4x32, type Words2 } from './philox';

export const RANDOM_PROTOCOL_VERSION = 1 as const;

export interface RandomStreamIdentity {
  readonly protocol: typeof RANDOM_PROTOCOL_VERSION;
  readonly key: Words2;
  readonly session: Words2;
}

export interface RandomStreamState extends RandomStreamIdentity {
  readonly block: Words2;
  readonly lane: number;
  readonly exhausted: boolean;
}

export class RandomStreamStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RandomStreamStateError';
  }
}

export class RandomStreamExhaustedError extends Error {
  constructor() {
    super('the random stream is exhausted; a tuple is never wrapped or reused');
    this.name = 'RandomStreamExhaustedError';
  }
}

const isWord = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0xffffffff;

const isWords2 = (value: unknown): value is Words2 =>
  Array.isArray(value) && value.length === 2 && value.every(isWord);

const isLastBlock = (low: number, high: number) => low === 0xffffffff && high === 0xffffffff;

export class RandomStream {
  private readonly key: Words2;
  private readonly session: Words2;
  private blockLow: number;
  private blockHigh: number;
  private lane: number;
  private exhausted: boolean;
  private blockOutputs: readonly number[] | undefined;

  private constructor(state: RandomStreamState) {
    this.key = [state.key[0], state.key[1]];
    this.session = [state.session[0], state.session[1]];
    this.blockLow = state.block[0];
    this.blockHigh = state.block[1];
    this.lane = state.lane;
    this.exhausted = state.exhausted;
  }

  static create(identity: RandomStreamIdentity): RandomStream {
    return RandomStream.restore({ ...identity, block: [0, 0], lane: 0, exhausted: false });
  }

  static restore(state: RandomStreamState): RandomStream {
    if (typeof state !== 'object' || state === null) throw new RandomStreamStateError('stream state is not an object');
    if (state.protocol !== RANDOM_PROTOCOL_VERSION) {
      throw new RandomStreamStateError(`unsupported random protocol ${String(state.protocol)}`);
    }
    if (!isWords2(state.key) || !isWords2(state.session) || !isWords2(state.block)) {
      throw new RandomStreamStateError('key, session and block must each be two unsigned 32-bit words');
    }
    if (!Number.isInteger(state.lane) || state.lane < 0 || state.lane > 3) {
      throw new RandomStreamStateError('lane must be 0, 1, 2 or 3');
    }
    if (typeof state.exhausted !== 'boolean') throw new RandomStreamStateError('exhausted must be a boolean');
    const lastTuple = isLastBlock(state.block[0], state.block[1]) && state.lane === 3;
    if (state.exhausted && !lastTuple) throw new RandomStreamStateError('only the last tuple can be exhausted');
    return new RandomStream(state);
  }

  state(): RandomStreamState {
    return {
      protocol: RANDOM_PROTOCOL_VERSION,
      key: [this.key[0], this.key[1]],
      session: [this.session[0], this.session[1]],
      block: [this.blockLow, this.blockHigh],
      lane: this.lane,
      exhausted: this.exhausted,
    };
  }

  nextUint32(): number {
    if (this.exhausted) throw new RandomStreamExhaustedError();
    const outputs = (this.blockOutputs ??= philox4x32(
      [this.blockLow, this.blockHigh, this.session[0], this.session[1]],
      this.key,
    ));
    const value = outputs[this.lane] as number;
    if (this.lane < 3) {
      this.lane++;
    } else if (isLastBlock(this.blockLow, this.blockHigh)) {
      this.exhausted = true;
    } else {
      this.blockOutputs = undefined;
      this.lane = 0;
      this.blockLow = (this.blockLow + 1) >>> 0;
      if (this.blockLow === 0) this.blockHigh++;
    }
    return value;
  }
}

const TWO_32 = 2 ** 32;

export function uniformInt(stream: RandomStream, n: number): number {
  if (!Number.isInteger(n) || n < 1 || n > TWO_32) throw new RangeError(`bounded sampling needs 1 <= n <= 2^32, got ${n}`);
  const limit = Math.floor(TWO_32 / n) * n;
  for (;;) {
    const draw = stream.nextUint32();
    if (draw < limit) return draw % n;
  }
}

// Spec 1 Amendment 6 §4
export function serverStreamIdentity(key: Words2, sessionIndex: number): RandomStreamIdentity {
  if (!isWords2(key)) throw new RandomStreamStateError('the coordinator key must be two unsigned 32-bit words');
  if (!Number.isSafeInteger(sessionIndex) || sessionIndex < 0) throw new RangeError(`a session index is a whole number from 0, got ${sessionIndex}`);
  return { protocol: RANDOM_PROTOCOL_VERSION, key: [key[0], key[1]], session: [sessionIndex % TWO_32, Math.floor(sessionIndex / TWO_32)] };
}

export interface EntropySource {
  randomBytes(length: 16): Uint8Array;
}

export function streamIdentityFromEntropy(source: EntropySource): RandomStreamIdentity {
  const bytes = source.randomBytes(16);
  if (bytes.length !== 16) throw new RangeError(`the entropy source must supply 16 bytes, got ${bytes.length}`);
  const view = new DataView(bytes.buffer, bytes.byteOffset, 16);
  const word = (index: number) => view.getUint32(index * 4, true);
  return { protocol: RANDOM_PROTOCOL_VERSION, key: [word(0), word(1)], session: [word(2), word(3)] };
}
