// The synchronization protocol, version 1: the upload envelope and its
// canonical request hash, the server's dispositions, and feed entries
// (spec 2, *Server transaction boundary and synchronization platform*).

import { canonicalJson, sha256Hex } from '@tableside/engine';

export const PROTOCOL_VERSION = 1;

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
  /**
   * Operations that must already have receipts on the server (its barriers
   * and dependencies). Absent when there are none, so a request without any
   * keeps the same text and hash.
   */
  readonly after?: readonly string[];
  /** A per-device type's originating-device position; absent for other types. */
  readonly position?: number;
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
  // Optional fields are left out, never sent empty.
  const { after, position, ...required } = envelope;
  const request = canonicalJson({ ...required, ...(after && after.length > 0 ? { after } : {}), ...(position !== undefined ? { position } : {}) });
  return { operationId: envelope.operation, request, requestHash: sha256Hex(request) };
}

/** A durable receipt's disposition: what the server decided, once, for an operation. */
export type Disposition =
  | { readonly status: 'accepted'; readonly operation: string; readonly requestHash: string; readonly sequence: number }
  | { readonly status: 'rejected'; readonly operation: string; readonly requestHash: string; readonly code: string };

/**
 * The upload operation's answer. Besides a receipt's disposition:
 * waiting, an operation it names in `after` has no receipt yet (nothing was recorded; the identical request is sent again later);
 * operation-reused, a different request already holds this operation ID (nothing was recorded);
 * incompatible, the server no longer speaks this protocol; malformed, the envelope couldn't be read.
 */
export type UploadAnswer =
  | Disposition
  | { readonly status: 'waiting' }
  | { readonly status: 'operation-reused' }
  | { readonly status: 'incompatible' }
  | { readonly status: 'malformed' };

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

export interface FeedPage {
  readonly entries: readonly FeedEntry[];
  /** More entries follow this page. */
  readonly more: boolean;
}
