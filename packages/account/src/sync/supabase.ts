// The sync engine's backend and live channel over Supabase: the versioned
// operations (supabase/migrations, `sync_upload_v1`, `sync_stage_chunk_v1`,
// `sync_feed_v1`, `sync_bootstrap_v1`, `sync_bootstrap_page_v1`,
// `realtime_claim_v1`), the unversioned `sync_protocol`, and the account's
// private Realtime topic.

import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

import type { SyncBackend } from './engine';
import type { LiveChannel } from './live';
import { type BootstrapPage, type BootstrapSnapshot, type ChunkAnswer, type FeedPage, type ProtocolStatus, SyncCallError, type UploadAnswer, chunkCallArguments } from './protocol';

/**
 * Transaction contention the server reports instead of waiting without bound:
 * a lock wait timeout, a serialization failure or a deadlock. The operations
 * are idempotent, so they are retried a bounded number of times, after a short pause.
 */
const CONTENTION = new Set(['55P03', '40001', '40P01']);
const CONTENTION_ATTEMPTS = 3;
const CONTENTION_PAUSE_MS = 100;
/** PostgREST couldn't reach or use the database. */
const SERVER_UNAVAILABLE = new Set(['PGRST000', 'PGRST001', 'PGRST002', 'PGRST003']);

/**
 * Every server operation this build calls: the versioned ones are protocol
 * PROTOCOL_VERSION's, and `sync_protocol` is unversioned. The release check
 * (test/compatibility.test.ts) holds the server to this list.
 */
export const SYNC_OPERATIONS = {
  protocol: 'sync_protocol',
  upload: 'sync_upload_v1',
  stageChunk: 'sync_stage_chunk_v1',
  feed: 'sync_feed_v1',
  claim: 'realtime_claim_v1',
  bootstrap: 'sync_bootstrap_v1',
  bootstrapPage: 'sync_bootstrap_page_v1',
} as const;

type Failure = SyncCallError['kind'] | 'contention';

/** What a failed call means, from its HTTP status and error code. */
function failureOf(status: number, code: string): Failure {
  // No response at all: postgrest-js reports a failed fetch as status 0.
  if (status === 0) return 'unreachable';
  // The pre-request hook refuses a retired protocol's operations (Upgrade Required).
  if (status === 426 || code === 'PT426') return 'incompatible';
  // An expired or refused token, or the authorization gate turning the session away.
  if (status === 401 || status === 403 || code.startsWith('PGRST30') || code === '42501') return 'auth';
  if (CONTENTION.has(code)) return 'contention';
  if (status === 429 || status === 502 || status === 503 || status === 504 || SERVER_UNAVAILABLE.has(code)) return 'busy';
  // The database's own trouble, whatever the request: a connection problem,
  // insufficient resources, a statement timeout or shutdown, an I/O or internal error.
  if (SERVER_FAULT_CLASSES.has(code.slice(0, 2)) || (status >= 500 && code === '')) return 'busy';
  // The server answered this request with an error about the request itself.
  return 'refused';
}

/** SQLSTATE classes that say nothing about the request: 08, 53, 57, 58 and XX. */
const SERVER_FAULT_CLASSES = new Set(['08', '53', '57', '58', 'XX']);

/**
 * Remembers the Retry-After a throttled or unavailable response carried, for
 * the call that got it. The client's fetch goes through `fetch`; the sync
 * engine runs one call at a time, so the last one seen is that call's.
 */
export class RetryAfterWatch {
  private last: number | null = null;

  constructor(private readonly clock: () => number) {}

  wrap(fetch: typeof globalThis.fetch): typeof globalThis.fetch {
    return async (input, init) => {
      const response = await fetch(input, init);
      const header = response.headers.get('retry-after');
      if ((response.status === 429 || response.status === 503) && header) this.last = this.parse(header);
      return response;
    };
  }

  /** The wait the last throttled response asked for, in milliseconds, once. */
  take(): number | null {
    const last = this.last;
    this.last = null;
    return last;
  }

  /** Seconds, or an HTTP date. */
  private parse(header: string): number | null {
    if (/^\d+$/.test(header.trim())) return Number(header.trim()) * 1000;
    const at = Date.parse(header);
    return Number.isNaN(at) ? null : Math.max(0, at - this.clock());
  }
}

/** Renews the session once: a new access token from the refresh token. */
async function renew(supabase: SupabaseClient): Promise<'renewed' | 'unreachable' | 'refused'> {
  try {
    const { data, error } = await supabase.auth.refreshSession();
    if (!error && data.session) return 'renewed';
    // AuthRetryableFetchError: the Auth server wasn't reached.
    return error && (error.status === 0 || error.name === 'AuthRetryableFetchError') ? 'unreachable' : 'refused';
  } catch {
    return 'unreachable';
  }
}

async function callOperation<T>(supabase: SupabaseClient, watch: RetryAfterWatch, operation: string, args: Record<string, unknown>): Promise<T> {
  let renewed = false;
  for (let attempt = 1; ; attempt++) {
    watch.take();
    const { data, error, status } = await supabase.rpc(operation, args);
    if (!error) return data as T;
    const failure = failureOf(status, error.code ?? '');
    if (failure === 'contention' && attempt < CONTENTION_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, CONTENTION_PAUSE_MS * attempt));
      continue;
    }
    // Renewal pending: a token that expired is renewed, without erasing or signing out anything, and the call made again.
    if (failure === 'auth' && !renewed) {
      renewed = true;
      const renewal = await renew(supabase);
      if (renewal === 'renewed') continue;
      throw new SyncCallError(renewal === 'unreachable' ? 'unreachable' : 'auth');
    }
    if (failure === 'contention' || failure === 'busy') throw new SyncCallError('busy', watch.take());
    throw new SyncCallError(failure);
  }
}

export function supabaseSyncBackend(supabase: SupabaseClient, watch: RetryAfterWatch): SyncBackend {
  return {
    protocol: (version) => callOperation<ProtocolStatus>(supabase, watch, SYNC_OPERATIONS.protocol, { protocol: version }),
    upload: (request) => callOperation<UploadAnswer>(supabase, watch, SYNC_OPERATIONS.upload, { request }),
    stageChunk: (chunk) => callOperation<ChunkAnswer>(supabase, watch, SYNC_OPERATIONS.stageChunk, chunkCallArguments(chunk)),
    feed: (after, pageSize) => callOperation<FeedPage>(supabase, watch, SYNC_OPERATIONS.feed, { after, page_size: pageSize }),
    async bootstrap(installation) {
      const answer = await callOperation<(BootstrapSnapshot & { status: 'snapshot' }) | { status: 'malformed' }>(supabase, watch, SYNC_OPERATIONS.bootstrap, { installation });
      if (answer.status !== 'snapshot') throw new SyncCallError('refused');
      const { snapshot, watermark, rows, totals } = answer;
      return { snapshot, watermark, rows, totals };
    },
    bootstrapPage: (snapshot, after, pageSize) =>
      callOperation<BootstrapPage>(supabase, watch, SYNC_OPERATIONS.bootstrapPage, { snapshot, after, page_size: pageSize }),
  };
}

/**
 * Connections to the account's private topic, one at a time. Only the server
 * sends on it. The client hands back a topic's channel until it has finished
 * leaving, so a new connection waits for the previous one to be gone.
 */
export function supabaseLiveChannels(supabase: SupabaseClient, accountId: string, watch: RetryAfterWatch): () => LiveChannel {
  let leaving: Promise<unknown> = Promise.resolve();
  return () => {
    let channel: RealtimeChannel | null = null;
    let left = false;
    return {
      join(handlers) {
        void (async () => {
          await leaving;
          if (left) return;
          const joined = supabase
            .channel(`account:${accountId}`, { config: { private: true } })
            .on('broadcast', { event: 'account-changed' }, () => handlers.hint())
            .on('broadcast', { event: 'live-holder' }, ({ payload }) => {
              const claim = (payload as { claim?: unknown } | undefined)?.claim;
              if (typeof claim === 'number') handlers.holder(claim);
            });
          channel = joined;
          try {
            // Private topics authorize with the session's current access token.
            await supabase.realtime.setAuth();
          } catch {
            return handlers.status('closed');
          }
          if (left) return;
          joined.subscribe((status) => handlers.status(status === 'SUBSCRIBED' ? 'joined' : 'closed'));
        })();
      },
      claim: async () => (await callOperation<{ claim: number }>(supabase, watch, SYNC_OPERATIONS.claim, {})).claim,
      leave() {
        left = true;
        // An installation without the live connection holds no Realtime
        // connection at all: the client keeps its socket open after the last
        // channel is removed, so it is disconnected here.
        if (!channel) return;
        leaving = supabase
          .removeChannel(channel)
          .then(() => (supabase.getChannels().length === 0 ? supabase.realtime.disconnect() : undefined))
          .catch(() => undefined);
      },
    };
  };
}
