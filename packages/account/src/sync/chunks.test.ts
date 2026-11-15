// Chunked results on the client (spec 2, *Chunked results*, #93): an upload
// too large for one request is sent as a manifest of bounded, content-hashed
// chunks, and every request body stays within the request limit.

import { createHash } from 'node:crypto';

import { canonicalJson } from '@tableside/engine';
import { describe, expect, it } from 'vitest';

import { CHUNK_BYTES, REQUEST_LIMIT_BYTES, chunkCallBody, chunksOf, prepareOperation, uploadCallBody } from './protocol';

const sha256 = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
const bytes = (text: string) => Buffer.byteLength(text, 'utf8');

function envelope(payload: unknown) {
  return {
    protocol: 1 as const,
    operation: 'a'.repeat(32),
    installation: 'installation-1',
    command: { generation: 1, position: 1 },
    recordType: 'completed-practice-session',
    payloadVersion: 1,
    item: 'activity-1',
    payload,
  };
}

/** A payload whose canonical text is at least `size` bytes, of the given characters. */
const payloadOf = (size: number, unit = 'x') => ({ detail: unit.repeat(Math.ceil(size / bytes(unit))) });

describe('an upload that fits in one request', () => {
  it('is sent whole, with no chunks', () => {
    const operation = prepareOperation(envelope({ detail: 'short' }));
    expect(JSON.parse(operation.request)).toMatchObject({ payload: { detail: 'short' } });
    expect(chunksOf(operation, { detail: 'short' })).toBeNull();
  });
});

describe('an upload too large for one request', () => {
  const payload = payloadOf(3 * CHUNK_BYTES + 100);
  const text = canonicalJson(payload);
  const operation = prepareOperation(envelope(payload));
  const chunks = chunksOf(operation, payload)!;

  it('names a manifest instead of the payload: each chunk’s SHA-256 in order, and the whole text’s', () => {
    const request = JSON.parse(operation.request) as Record<string, unknown>;
    expect(request.payload).toBeUndefined();
    expect(request.content).toEqual({ chunkBytes: CHUNK_BYTES, chunks: chunks.map((chunk) => sha256(chunk.data)), sha256: sha256(text) });
  });

  it('splits the payload’s exact text into bounded chunks that rejoin to it, truncating nothing', () => {
    // ASCII text: one byte per character, so the chunks are its 48 KiB slices.
    expect(chunks.map((chunk) => chunk.data)).toEqual([0, 1, 2, 3].map((index) => text.slice(index * CHUNK_BYTES, (index + 1) * CHUNK_BYTES)));
    expect(chunks.map((chunk) => chunk.data).join('')).toBe(text);
    for (const chunk of chunks) {
      expect(bytes(chunk.data)).toBeLessThanOrEqual(CHUNK_BYTES);
      expect(chunk).toMatchObject({ recordType: 'completed-practice-session', item: 'activity-1', sha256: sha256(chunk.data) });
    }
  });

  it('never splits a character: multi-byte text still rejoins exactly', () => {
    const wide = payloadOf(4 * CHUNK_BYTES, 'é🂡');
    const wideChunks = chunksOf(prepareOperation(envelope(wide)), wide)!;
    expect(wideChunks.map((chunk) => chunk.data).join('')).toBe(canonicalJson(wide));
    for (const chunk of wideChunks) {
      expect(bytes(chunk.data)).toBeLessThanOrEqual(CHUNK_BYTES);
      expect(Buffer.from(chunk.data, 'utf8').toString('utf8')).toBe(chunk.data);
    }
  });

  it('gives the same chunks every time, so a resend repeats the same bytes', () => {
    expect(chunksOf(prepareOperation(envelope(payload)), payload)).toEqual(chunks);
  });

  it('refuses to send chunks that no longer match the stored manifest', () => {
    expect(() => chunksOf(operation, payloadOf(3 * CHUNK_BYTES + 101))).toThrow();
  });
});

describe('the request limit', () => {
  it('bounds every request body, even for text that doubles when escaped', () => {
    // Quotes and backslashes escape to two bytes inside a JSON string: the worst case.
    for (const unit of ['x', '"', '\\', 'é', '🂡']) {
      for (const size of [REQUEST_LIMIT_BYTES / 4, REQUEST_LIMIT_BYTES / 2 - 200, REQUEST_LIMIT_BYTES, 5 * REQUEST_LIMIT_BYTES]) {
        const payload = payloadOf(size, unit);
        const operation = prepareOperation(envelope(payload));
        expect(bytes(uploadCallBody(operation.request)), `${unit} × ${size}`).toBeLessThanOrEqual(REQUEST_LIMIT_BYTES);
        for (const chunk of chunksOf(operation, payload) ?? []) expect(bytes(chunkCallBody(chunk))).toBeLessThanOrEqual(REQUEST_LIMIT_BYTES);
      }
    }
  });
});
