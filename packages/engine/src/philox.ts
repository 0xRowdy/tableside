// docs/decisions/mobile-platform-shared-game-engine.md Reproducible random protocol
// docs/development.md Engine portability

export type Words4 = readonly [number, number, number, number];
export type Words2 = readonly [number, number];

const M0 = 0xd2511f53;
const M1 = 0xcd9e8d57;
const W0 = 0x9e3779b9;
const W1 = 0xbb67ae85;

function mulhi(a: number, b: number): number {
  const aH = a >>> 16;
  const aL = a & 0xffff;
  const bH = b >>> 16;
  const bL = b & 0xffff;
  const lh = aL * bH;
  const hl = aH * bL;
  const carry = ((aL * bL) >>> 16) + (lh & 0xffff) + (hl & 0xffff);
  return (aH * bH + (lh >>> 16) + (hl >>> 16) + (carry >>> 16)) >>> 0;
}

export function philox4x32(counter: Words4, key: Words2): [number, number, number, number] {
  let [c0, c1, c2, c3] = counter;
  let [k0, k1] = key;
  for (let round = 0; round < 10; round++) {
    if (round > 0) {
      k0 = (k0 + W0) >>> 0;
      k1 = (k1 + W1) >>> 0;
    }
    const hi0 = mulhi(M0, c0);
    const lo0 = Math.imul(M0, c0) >>> 0;
    const hi1 = mulhi(M1, c2);
    const lo1 = Math.imul(M1, c2) >>> 0;
    [c0, c1, c2, c3] = [(hi1 ^ c1 ^ k0) >>> 0, lo1, (hi0 ^ c3 ^ k1) >>> 0, lo0];
  }
  return [c0, c1, c2, c3];
}
