// The synchronization protocol, version 1: the upload envelope and its
// canonical request hash, the server's dispositions, and feed entries
// (spec 2, *Server transaction boundary and synchronization platform*).

import { canonicalJson, sha256Hex } from '@tableside/engine';

import type { TotalsRow } from './totals';

export const PROTOCOL_VERSION = 1;

/**
 * What the server says about a protocol version (`sync_protocol`). The
 * operation is unversioned and its answer's shape never changes, so every
 * build, however old, can ask whether it may still sync.
 * retiring: still served until `retiresAt`, announced at least 30 days ahead,
 * unless `reason` explains an urgent restriction. retired: no longer served;
 * the build must update before it syncs again.
 */
export type ProtocolStatus =
  | { readonly status: 'supported' }
  | { readonly status: 'retiring'; readonly retiresAt: string; readonly reason: string | null }
  | { readonly status: 'retired'; readonly reason: string | null };

/**
 * The most any request body may hold, in UTF-8 bytes (spec 2 Amendment 1 C5:
 * a conservative request limit, tested against the pinned Supabase stack).
 * The stack's gateway (Kong 2.8, `client_max_body_size 0`) and PostgREST 14
 * impose no bound of their own; seam 2 checks a body four times this size gets
 * through, so the operations' own refusal is the limit. The hosted project's
 * proxy is qualified at launch gate 12.
 */
export const REQUEST_LIMIT_BYTES = 128 * 1024;

/**
 * The most text one chunk holds, in UTF-8 bytes. Escaped inside its request a
 * chunk at most doubles (every quote or backslash becomes two bytes), which
 * leaves 32 KiB of the request limit for the rest of the call.
 */
export const CHUNK_BYTES = 48 * 1024;

/**
 * A command's place in its installation's command scope (spec 2, *Compaction
 * and stale devices*): the generation the server issued the installation in
 * this account, and the command's position there, from 1, never reused.
 */
export interface Command {
  readonly generation: number;
  readonly position: number;
}

/** What an upload names. The account is never in it: the server takes it from verified authentication. */
export interface Envelope {
  readonly protocol: typeof PROTOCOL_VERSION;
  /** Stable random operation ID: 32 lowercase hex digits, minted once per genuinely new operation. */
  readonly operation: string;
  /** The originating installation. */
  readonly installation: string;
  /** Its scope and position: the server refuses a generation it no longer serves, or a position settled or taken. */
  readonly command: Command;
  readonly recordType: string;
  readonly payloadVersion: number;
  /** The item's identity under its record type's identity scheme. */
  readonly item: string;
  readonly payload: unknown;
  /**
   * Operations that must already have receipts on the server (its barriers
   * and dependencies). Absent when there are none, so a request without any
   * keeps the same text and hash.
   */
  readonly after?: readonly string[];
  /** A per-device type's originating-device position; absent for other types. */
  readonly position?: number;
}

/**
 * What a request too large to send whole names instead of its payload: the
 * payload's canonical text split into chunks of at most `chunkBytes`, each by
 * its SHA-256 in order, and the SHA-256 of the whole text. The server accepts
 * the operation only once every chunk is staged and they rejoin to that text.
 */
export interface ContentManifest {
  readonly chunkBytes: number;
  readonly chunks: readonly string[];
  readonly sha256: string;
}

/** One chunk of a result, staged privately until the operation naming it is accepted. */
export interface StagedChunk {
  readonly recordType: string;
  /** The result's identity: chunks are staged per (account, record type, item). */
  readonly item: string;
  /** SHA-256 of the chunk's text: its identity within the result. */
  readonly sha256: string;
  readonly data: string;
}

/** An operation fixed for sending: the exact request text every retry repeats, and its hash. */
export interface PreparedOperation {
  readonly operationId: string;
  /** The envelope as canonical JSON text. */
  readonly request: string;
  /** SHA-256 of the request text, as the server computes it: the canonical request hash. */
  readonly requestHash: string;
}

/** The body of an upload call: the request text as its one argument. */
export const uploadCallBody = (request: string): string => JSON.stringify({ request });

/** The arguments of a chunk-staging call, as the operation names them. */
export const chunkCallArguments = (chunk: StagedChunk) => ({
  protocol: PROTOCOL_VERSION,
  record_type: chunk.recordType,
  item: chunk.item,
  sha256: chunk.sha256,
  data: chunk.data,
});

/** The body of a chunk-staging call. */
export const chunkCallBody = (chunk: StagedChunk): string => JSON.stringify(chunkCallArguments(chunk));

/**
 * Fixes the request for an envelope: the payload whole when the call fits the
 * request limit, otherwise a manifest of its chunks. Throws when even the
 * manifest wouldn't fit (a payload of roughly 90 MiB).
 */
export function prepareOperation(envelope: Envelope): PreparedOperation {
  // Optional fields are left out, never sent empty.
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

/**
 * The chunks a prepared operation names, rebuilt from the payload it was
 * prepared from; null when it carries its payload whole. Throws when the
 * payload no longer matches the stored manifest, so nothing else is ever sent under it.
 */
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

/** UTF-8 length of one code point. */
const codePointBytes = (code: number): number => (code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4);

function utf8Length(text: string): number {
  let length = 0;
  for (const char of text) length += codePointBytes(char.codePointAt(0)!);
  return length;
}

/** Splits text into pieces of at most `limit` UTF-8 bytes, never inside a character. */
function splitText(text: string, limit: number): string[] {
  const parts: string[] = [];
  let start = 0;
  let size = 0;
  let at = 0;
  for (const char of text) {
    const charBytes = codePointBytes(char.codePointAt(0)!);
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

/** A durable receipt's disposition: what the server decided, once, for an operation. */
export type Disposition =
  | { readonly status: 'accepted'; readonly operation: string; readonly requestHash: string; readonly sequence: number }
  | { readonly status: 'rejected'; readonly operation: string; readonly requestHash: string; readonly code: string };

/**
 * The upload operation's answer. Besides a receipt's disposition:
 * waiting, an operation it names in `after` has no receipt yet (nothing was recorded; the identical request is sent again later);
 * stale-scope, the server can no longer interpret the command: its generation retired or was replaced (or never issued), or its position was
 * settled (its receipt gone) or is another command's. Nothing was recorded, and it is never taken for a new command: the device
 * refreshes, reconciles its unsynced work, and takes a new generation;
 * operation-reused, a different request already holds this operation ID (nothing was recorded);
 * incompatible, the server no longer speaks this protocol; malformed, the envelope couldn't be read
 * (or is over the request limit).
 */
export type UploadAnswer =
  | Disposition
  | { readonly status: 'waiting' }
  | { readonly status: 'stale-scope'; readonly reason: 'retired' | 'replaced' | 'settled' | 'reused' }
  | { readonly status: 'operation-reused' }
  | { readonly status: 'incompatible' }
  | { readonly status: 'malformed' }
  /** The manifest names chunks the server hasn't staged (never sent, or expired): stage them and send again. Nothing was recorded. */
  | { readonly status: 'chunks-missing'; readonly missing: readonly number[] };

/** The chunk-staging operation's answer. staging-full: the account's staging is at its bound until uploads complete or expire. */
export type ChunkAnswer =
  | { readonly status: 'staged' }
  | { readonly status: 'incompatible' }
  | { readonly status: 'malformed' }
  | { readonly status: 'staging-full' };

/**
 * Why a backend call got no usable answer.
 * unreachable: nothing came back (no connection, a lost response, a gateway error).
 * busy: the server is overloaded or rate-limited the call; `retryAfter` is how long it asked to wait.
 * auth: the session wasn't accepted, even after renewing it: the player must sign in again.
 * incompatible: the server no longer serves this protocol version.
 * refused: the server answered this request with an error: the request itself fails.
 */
export class SyncCallError extends Error {
  constructor(
    readonly kind: 'unreachable' | 'busy' | 'auth' | 'incompatible' | 'refused',
    /** Milliseconds the server asked the client to wait before calling again. */
    readonly retryAfter: number | null = null,
  ) {
    super(`sync call failed: ${kind}`);
    this.name = 'SyncCallError';
  }
}

/**
 * One accepted change in the account's feed. Sequences are gap-free and in
 * commit order. A purged result's entries keep their sequence with a null
 * change: there is nothing to apply. A per-device type's change also carries
 * the platform's `origin`: the record's originating installation and position.
 */
export interface FeedEntry {
  readonly sequence: number;
  readonly recordType: string;
  readonly item: string;
  readonly change: unknown;
}

/**
 * A page of the feed, or reset: the entries after the cursor were pruned
 * behind the account's reset boundary (`through`), so the device takes a new
 * snapshot, keeping its upload queue and its records.
 */
export type FeedPage =
  | { readonly status?: undefined; readonly entries: readonly FeedEntry[]; /** More entries follow this page. */ readonly more: boolean }
  | { readonly status: 'reset'; readonly through: number };

/**
 * The installation's command scope (`sync_scope_v1`): the generation to send
 * commands under, and the position the server has recorded it settled
 * through; or stale-scope, when the generation named is no longer served.
 */
export type ScopeAnswer =
  | { readonly status: 'scope'; readonly generation: number; readonly settled: number }
  | { readonly status: 'stale-scope' }
  | { readonly status: 'malformed' };

/**
 * A bootstrap snapshot (`sync_bootstrap_v1`): every registered type's
 * summaries and the account's lifetime totals, made in one transaction under
 * the synchronization head, so all of them describe the account at `watermark`.
 */
export interface BootstrapSnapshot {
  readonly snapshot: string;
  /** The account sequence the rows and totals describe: the feed is applied after it. */
  readonly watermark: number;
  /** How many rows it was made with (the feed's redactions can remove some later). */
  readonly rows: number;
  /** The account's lifetime totals at the watermark. */
  readonly totals: readonly TotalsRow[];
}

/**
 * One snapshot row: a type's summary of an item, as a feed change of the
 * type, at the item's latest change; or, with a null change, a result purged
 * from the account, which the device removes and never accepts again.
 */
export interface BootstrapRow extends FeedEntry {
  /** Its place in the snapshot, from 1. Ordinals can skip where the feed redacted a row. */
  readonly ordinal: number;
}

/** A page of a snapshot (`sync_bootstrap_page_v1`); expired once it is gone (24 hours, or replaced), and a new one is needed. */
export type BootstrapPage =
  | { readonly status: 'page'; readonly rows: readonly BootstrapRow[]; readonly more: boolean }
  | { readonly status: 'expired' };
