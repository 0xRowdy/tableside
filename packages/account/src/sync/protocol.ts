// Spec 2 Server transaction boundary and synchronization platform

import { canonicalJson, sha256Hex } from '@tableside/engine';

import type { TotalsRow } from './totals';

export const PROTOCOL_VERSION = 1;

export type ProtocolStatus =
  | { readonly status: 'supported' }
  | { readonly status: 'retiring'; readonly retiresAt: string; readonly reason: string | null }
  | { readonly status: 'retired'; readonly reason: string | null };

// Spec 2 Amendment 1 C5
export const REQUEST_LIMIT_BYTES = 128 * 1024;

export const CHUNK_BYTES = 48 * 1024;

// Spec 2 Compaction and stale devices
export interface Command {
  readonly generation: number;
  readonly position: number;
}

export interface Envelope {
  readonly protocol: typeof PROTOCOL_VERSION;
  readonly operation: string;
  readonly installation: string;
  readonly command: Command;
  readonly recordType: string;
  readonly payloadVersion: number;
  readonly item: string;
  readonly payload: unknown;
  readonly after?: readonly string[];
  readonly position?: number;
}

export interface ContentManifest {
  readonly chunkBytes: number;
  readonly chunks: readonly string[];
  readonly sha256: string;
}

export interface StagedChunk {
  readonly recordType: string;
  readonly item: string;
  readonly sha256: string;
  readonly data: string;
}

export interface PreparedOperation {
  readonly operationId: string;
  readonly request: string;
  readonly requestHash: string;
}

export const uploadCallBody = (request: string): string => JSON.stringify({ request });

export const chunkCallArguments = (chunk: StagedChunk) => ({
  protocol: PROTOCOL_VERSION,
  record_type: chunk.recordType,
  item: chunk.item,
  sha256: chunk.sha256,
  data: chunk.data,
});

export const chunkCallBody = (chunk: StagedChunk): string => JSON.stringify(chunkCallArguments(chunk));

export function prepareOperation(envelope: Envelope): PreparedOperation {
  const { after, position, ...required } = envelope;
  const sent = { ...required, ...(after && after.length > 0 ? { after } : {}), ...(position !== undefined ? { position } : {}) };
  let request = canonicalJson(sent);
  if (utf8Length(uploadCallBody(request)) > REQUEST_LIMIT_BYTES) {
    const { payload, ...rest } = sent;
    const text = canonicalJson(payload);
    const content: ContentManifest = { chunkBytes: CHUNK_BYTES, chunks: splitText(text, CHUNK_BYTES).map(sha256Hex), sha256: sha256Hex(text) };
    request = canonicalJson({ ...rest, content });
    if (utf8Length(uploadCallBody(request)) > REQUEST_LIMIT_BYTES) throw new Error('the result is too large to name in one request');
  }
  return { operationId: envelope.operation, request, requestHash: sha256Hex(request) };
}

export function chunksOf(operation: PreparedOperation, payload: unknown): StagedChunk[] | null {
  const request = JSON.parse(operation.request) as { recordType: string; item: string; content?: ContentManifest };
  const { content } = request;
  if (!content) return null;
  const text = canonicalJson(payload);
  const parts = splitText(text, content.chunkBytes);
  const hashes = parts.map(sha256Hex);
  if (sha256Hex(text) !== content.sha256 || hashes.length !== content.chunks.length || hashes.some((hash, index) => hash !== content.chunks[index])) {
    throw new Error(`the payload of operation ${operation.operationId} no longer matches its manifest`);
  }
  return parts.map((data, index) => ({ recordType: request.recordType, item: request.item, sha256: hashes[index]!, data }));
}

const utf8BytesOfCodePoint = (code: number): number => (code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4);

export function utf8Length(text: string): number {
  let length = 0;
  for (const char of text) length += utf8BytesOfCodePoint(char.codePointAt(0)!);
  return length;
}

function splitText(text: string, limit: number): string[] {
  const parts: string[] = [];
  let start = 0;
  let size = 0;
  let at = 0;
  for (const char of text) {
    const charBytes = utf8BytesOfCodePoint(char.codePointAt(0)!);
    if (size + charBytes > limit) {
      parts.push(text.slice(start, at));
      start = at;
      size = 0;
    }
    size += charBytes;
    at += char.length;
  }
  parts.push(text.slice(start));
  return parts;
}

export type Disposition =
  | { readonly status: 'accepted'; readonly operation: string; readonly requestHash: string; readonly sequence: number }
  | { readonly status: 'rejected'; readonly operation: string; readonly requestHash: string; readonly code: string };

export type UploadAnswer =
  | Disposition
  | { readonly status: 'waiting' }
  | { readonly status: 'stale-scope'; readonly reason: 'retired' | 'replaced' | 'settled' | 'reused' }
  | { readonly status: 'operation-reused' }
  | { readonly status: 'incompatible' }
  | { readonly status: 'malformed' }
  | { readonly status: 'chunks-missing'; readonly missing: readonly number[] };

export type ChunkAnswer =
  | { readonly status: 'staged' }
  | { readonly status: 'incompatible' }
  | { readonly status: 'malformed' }
  | { readonly status: 'staging-full' };

export class SyncCallError extends Error {
  constructor(
    readonly kind: 'unreachable' | 'busy' | 'auth' | 'incompatible' | 'refused',
    readonly retryAfter: number | null = null,
  ) {
    super(`sync call failed: ${kind}`);
    this.name = 'SyncCallError';
  }
}

export interface FeedEntry {
  readonly sequence: number;
  readonly recordType: string;
  readonly item: string;
  readonly change: unknown;
}

export type FeedPage =
  | { readonly status?: undefined; readonly entries: readonly FeedEntry[]; readonly more: boolean }
  | { readonly status: 'reset'; readonly through: number };

export type ScopeAnswer =
  | { readonly status: 'scope'; readonly generation: number; readonly settled: number }
  | { readonly status: 'stale-scope' }
  | { readonly status: 'malformed' };

export interface BootstrapSnapshot {
  readonly snapshot: string;
  readonly watermark: number;
  readonly rows: number;
  readonly totals: readonly TotalsRow[];
}

export interface BootstrapRow extends FeedEntry {
  readonly ordinal: number;
}

export type BootstrapPage =
  | { readonly status: 'page'; readonly rows: readonly BootstrapRow[]; readonly more: boolean }
  | { readonly status: 'expired' };

export const PAGE_BYTES = 256 * 1024;

export const DETAIL_REQUESTS = 100;

export interface DetailRequest {
  readonly recordType: string;
  readonly item: string;
  readonly sequence: number;
}

export type DetailAnswer =
  | { readonly recordType: string; readonly item: string; readonly status: 'detail'; readonly sequence: number; readonly change: unknown }
  | { readonly recordType: string; readonly item: string; readonly status: 'changed'; readonly sequence: number }
  | { readonly recordType: string; readonly item: string; readonly status: 'gone' };

// Spec 2 Amendment 1 C5
export type DetailPage =
  | { readonly status: 'details'; readonly answers: readonly DetailAnswer[] }
  | { readonly status: 'throttled'; readonly retryAfter: number };
