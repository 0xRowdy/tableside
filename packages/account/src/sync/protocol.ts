// The synchronization protocol, version 1: the upload envelope and its
// canonical request hash, the server's dispositions, and feed entries
// (spec 2, *Server transaction boundary and synchronization platform*).

import { canonicalJson, sha256Hex } from '@tableside/engine';

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

/** What an upload names. The account is never in it: the server takes it from verified authentication. */
export interface Envelope {
  readonly protocol: typeof PROTOCOL_VERSION;
  /** Stable random operation ID: 32 lowercase hex digits, minted once per genuinely new operation. */
  readonly operation: string;
  /** The originating installation. */
  readonly installation: string;
  readonly recordType: string;
  readonly payloadVersion: number;
  /** The item's identity under its record type's identity scheme. */
  readonly item: string;
  readonly payload: unknown;
}

/** An operation fixed for sending: the exact request text every retry repeats, and its hash. */
export interface PreparedOperation {
  readonly operationId: string;
  /** The envelope as canonical JSON text. */
  readonly request: string;
  /** SHA-256 of the request text, as the server computes it: the canonical request hash. */
  readonly requestHash: string;
}

export function prepareOperation(envelope: Envelope): PreparedOperation {
  const request = canonicalJson(envelope);
  return { operationId: envelope.operation, request, requestHash: sha256Hex(request) };
}

/** A durable receipt's disposition: what the server decided, once, for an operation. */
export type Disposition =
  | { readonly status: 'accepted'; readonly operation: string; readonly requestHash: string; readonly sequence: number }
  | { readonly status: 'rejected'; readonly operation: string; readonly requestHash: string; readonly code: string };

/**
 * The upload operation's answer. Besides a receipt's disposition:
 * operation-reused, a different request already holds this operation ID (nothing was recorded);
 * incompatible, the server no longer speaks this protocol; malformed, the envelope couldn't be read.
 */
export type UploadAnswer =
  | Disposition
  | { readonly status: 'operation-reused' }
  | { readonly status: 'incompatible' }
  | { readonly status: 'malformed' };

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

/** One accepted change in the account's feed. Sequences are gap-free and in commit order. */
export interface FeedEntry {
  readonly sequence: number;
  readonly recordType: string;
  readonly item: string;
  readonly change: unknown;
}

export interface FeedPage {
  readonly entries: readonly FeedEntry[];
  /** More entries follow this page. */
  readonly more: boolean;
}
