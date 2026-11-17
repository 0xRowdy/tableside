import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

import type { SyncBackend } from './engine';
import type { LiveChannel } from './live';
import {
  type BootstrapPage,
  type BootstrapSnapshot,
  type ChunkAnswer,
  type DetailPage,
  type FeedPage,
  type ProtocolStatus,
  type ScopeAnswer,
  SyncCallError,
  type UploadAnswer,
  chunkCallArguments,
} from './protocol';

const CONTENTION_SQLSTATES = new Set(['55P03', '40001', '40P01']);
const CONTENTION_ATTEMPTS = 3;
const CONTENTION_PAUSE_MS = 100;
const POSTGREST_DATABASE_UNAVAILABLE = new Set(['PGRST000', 'PGRST001', 'PGRST002', 'PGRST003']);

export const SYNC_OPERATIONS = {
  protocol: 'sync_protocol',
  upload: 'sync_upload_v1',
  stageChunk: 'sync_stage_chunk_v1',
  feed: 'sync_feed_v1',
  claim: 'realtime_claim_v1',
  bootstrap: 'sync_bootstrap_v1',
  bootstrapPage: 'sync_bootstrap_page_v1',
  scope: 'sync_scope_v1',
  details: 'sync_details_v1',
} as const;

type Failure = SyncCallError['kind'] | 'contention';

function failureOf(status: number, code: string): Failure {
  if (status === 0) return 'unreachable';
  if (status === 426 || code === 'PT426') return 'incompatible';
  if (status === 401 || status === 403 || code.startsWith('PGRST30') || code === '42501') return 'auth';
  if (CONTENTION_SQLSTATES.has(code)) return 'contention';
  if (status === 429 || status === 502 || status === 503 || status === 504 || POSTGREST_DATABASE_UNAVAILABLE.has(code)) return 'busy';
  if (DATABASE_FAULT_SQLSTATE_CLASSES.has(code.slice(0, 2)) || (status >= 500 && code === '')) return 'busy';
  return 'refused';
}

const DATABASE_FAULT_SQLSTATE_CLASSES = new Set(['08', '53', '57', '58', 'XX']);

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

  take(): number | null {
    const last = this.last;
    this.last = null;
    return last;
  }

  private parse(header: string): number | null {
    if (/^\d+$/.test(header.trim())) return Number(header.trim()) * 1000;
    const at = Date.parse(header);
    return Number.isNaN(at) ? null : Math.max(0, at - this.clock());
  }
}

async function renew(supabase: SupabaseClient): Promise<'renewed' | 'unreachable' | 'refused'> {
  try {
    const { data, error } = await supabase.auth.refreshSession();
    if (!error && data.session) return 'renewed';
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
    scope: (installation, generation, settled) =>
      callOperation<ScopeAnswer>(supabase, watch, SYNC_OPERATIONS.scope, { installation, generation, settled }),
    async details(requests, bulk) {
      const answer = await callOperation<DetailPage | { status: 'malformed' }>(supabase, watch, SYNC_OPERATIONS.details, { requests, bulk });
      if (answer.status === 'malformed') throw new SyncCallError('refused');
      return answer;
    },
  };
}

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
        if (!channel) return;
        leaving = supabase
          .removeChannel(channel)
          .then(() => (supabase.getChannels().length === 0 ? supabase.realtime.disconnect() : undefined))
          .catch(() => undefined);
      },
    };
  };
}
