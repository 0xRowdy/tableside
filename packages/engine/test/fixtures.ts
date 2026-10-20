// Helpers shared by the engine's case files.
import { RANDOM_PROTOCOL_VERSION, type RandomStreamIdentity } from '../src';

/** The all-zero identity: block 0 is the first Random123 known answer. */
export const ZERO: RandomStreamIdentity = { protocol: RANDOM_PROTOCOL_VERSION, key: [0, 0], session: [0, 0] };

/** The key and session words of the Random123 "pi digits" known answer. */
export const PI: RandomStreamIdentity = {
  protocol: RANDOM_PROTOCOL_VERSION,
  key: [0xa4093822, 0x299f31d0],
  session: [0x13198a2e, 0x03707344],
};

/** The name of the error `run` throws, or "no error". */
export function throws(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    return error instanceof Error ? error.name : 'non-error';
  }
  return 'no error';
}
