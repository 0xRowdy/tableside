// SHA-256 behind checkpoint hashes. Expected digests: the FIPS 180-2 examples
// ("abc", the 448-bit message) and, for padding boundaries and UTF-8 text,
// Node's OpenSSL-backed crypto.createHash('sha256'), an independent implementation.
import type { TestCase } from '@tableside/harness';

import { sha256Hex } from '../src';

const vectors: [string, string, string][] = [
  ['empty', '', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
  ['abc', 'abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
  [
    '448-bit message',
    'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq',
    '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
  ],
  ['UTF-8 text with an astral character', 'é€𝄞 tableside', '684b93628c631810cac90103908c7d8f9d898113be962e1f106a643d1083b7ec'],
  ['55 bytes (one block)', 'a'.repeat(55), '9f4390f8d30c2dd92ec9f095b65e2b9ae9b0a925a5258e241c9f1e910f734318'],
  ['56 bytes (padding spills)', 'a'.repeat(56), 'b35439a4ac6f0948b6d6f9e3c6af0f5f590ce20f1bde7090ef7970686ec6738a'],
  ['64 bytes', 'a'.repeat(64), 'ffe054fe7ae0cb6dc65c3af9b61d5209f439851db43d0ba5997337df154668eb'],
  ['1000 bytes', 'a'.repeat(1000), '41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3'],
];

export const hashCases: TestCase[] = vectors.map(([name, text, digest]) => ({
  name: `hash: SHA-256 of ${name}`,
  run: (t) => t.equal(sha256Hex(text), digest),
}));
