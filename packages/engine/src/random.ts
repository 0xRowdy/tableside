// Random protocol version 1: a Philox4x32-10 stream addressed by a 64-bit key,
// a 64-bit session and a 64-bit block. The counter is
// [blockLow32, blockHigh32, sessionLow32, sessionHigh32] and the key
// [keyLow32, keyHigh32]. Draws start at block 0 / lane 0 and take lanes 0-3
// before the block advances. The stream never wraps: once the last tuple of the
// last block has been drawn, it is exhausted and every further draw throws.

import { philox4x32, type Words2 } from './philox';

export const RANDOM_PROTOCOL_VERSION = 1 as const;

/** Which stream an activity draws from. Recorded durably before first content. */
export interface RandomStreamIdentity {
  readonly protocol: typeof RANDOM_PROTOCOL_VERSION;
  /** [keyLow32, keyHigh32] */
  readonly key: Words2;
  /**
   * [sessionLow32, sessionHigh32]: the counter's stream-session words, not a
   * practice session. Device activities take them from secure entropy; server
   * runs use the session index.
   */
  readonly session: Words2;
}

/** The serializable position of a stream: the next tuple to draw. */
export interface RandomStreamState extends RandomStreamIdentity {
  /** [blockLow32, blockHigh32] */
  readonly block: Words2;
  readonly lane: number;
  /** True once the final tuple (block 2^64 - 1, lane 3) has been drawn. */
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

/** Block 2^64 - 1, the last block before the counter would wrap. */
const isLastBlock = (low: number, high: number) => low === 0xffffffff && high === 0xffffffff;

export class RandomStream {
  private readonly key: Words2;
  private readonly session: Words2;
  private blockLow: number;
  private blockHigh: number;
  private lane: number;
  private exhausted: boolean;
  /** Outputs of the current block, computed when lane 0 is drawn or on restore. */
  private outputs: readonly number[] | undefined;

  private constructor(state: RandomStreamState) {
    this.key = [state.key[0], state.key[1]];
    this.session = [state.session[0], state.session[1]];
    this.blockLow = state.block[0];
    this.blockHigh = state.block[1];
    this.lane = state.lane;
    this.exhausted = state.exhausted;
  }

  /** A fresh stream at block 0, lane 0. */
  static create(identity: RandomStreamIdentity): RandomStream {
    return RandomStream.restore({ ...identity, block: [0, 0], lane: 0, exhausted: false });
  }

  /** Resumes a stream from a saved position. Damaged or unsupported states throw RandomStreamStateError. */
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

  /** The position of the next draw, as plain serializable data. */
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

  /** The next unsigned 32-bit draw. */
  nextUint32(): number {
    if (this.exhausted) throw new RandomStreamExhaustedError();
    const outputs = (this.outputs ??= philox4x32(
      [this.blockLow, this.blockHigh, this.session[0], this.session[1]],
      this.key,
    ));
    const value = outputs[this.lane] as number;
    if (this.lane < 3) {
      this.lane++;
    } else if (isLastBlock(this.blockLow, this.blockHigh)) {
      this.exhausted = true;
    } else {
      this.outputs = undefined;
      this.lane = 0;
      this.blockLow = (this.blockLow + 1) >>> 0;
      if (this.blockLow === 0) this.blockHigh++;
    }
    return value;
  }
}

const TWO_32 = 2 ** 32;

/**
 * A uniform integer in [0, n) for integer 1 <= n <= 2^32. Draws at or above
 * floor(2^32 / n) * n are rejected and redrawn; rejected draws still advance
 * the stream. Accepted draws map by remainder.
 */
export function uniformInt(stream: RandomStream, n: number): number {
  if (!Number.isInteger(n) || n < 1 || n > TWO_32) throw new RangeError(`bounded sampling needs 1 <= n <= 2^32, got ${n}`);
  const limit = Math.floor(TWO_32 / n) * n;
  for (;;) {
    const draw = stream.nextUint32();
    if (draw < limit) return draw % n;
  }
}

/**
 * The secure native entropy adapter. The app supplies it; the engine never
 * seeds from clocks or other predictable state.
 */
export interface EntropySource {
  randomBytes(length: 16): Uint8Array;
}

/**
 * A device activity's stream identity: 16 secure bytes read as four
 * little-endian unsigned 32-bit words, the first two the key and the next two
 * the session.
 */
export function streamIdentityFromEntropy(source: EntropySource): RandomStreamIdentity {
  const bytes = source.randomBytes(16);
  if (bytes.length !== 16) throw new RangeError(`the entropy source must supply 16 bytes, got ${bytes.length}`);
  const view = new DataView(bytes.buffer, bytes.byteOffset, 16);
  const word = (index: number) => view.getUint32(index * 4, true);
  return { protocol: RANDOM_PROTOCOL_VERSION, key: [word(0), word(1)], session: [word(2), word(3)] };
}
