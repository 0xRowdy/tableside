import { RANDOM_PROTOCOL_VERSION, type RandomStreamIdentity } from '../src';

export const ZERO: RandomStreamIdentity = { protocol: RANDOM_PROTOCOL_VERSION, key: [0, 0], session: [0, 0] };

export const PI: RandomStreamIdentity = {
  protocol: RANDOM_PROTOCOL_VERSION,
  key: [0xa4093822, 0x299f31d0],
  session: [0x13198a2e, 0x03707344],
};

export function throws(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    return error instanceof Error ? error.name : 'non-error';
  }
  return 'no error';
}
