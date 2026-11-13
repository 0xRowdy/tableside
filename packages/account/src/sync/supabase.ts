// The sync engine's backend and live channel over Supabase: the versioned
// operations (supabase/migrations, `sync_upload_v1`, `sync_feed_v1`,
// `realtime_claim_v1`) and the account's private Realtime topic.

import type { SupabaseClient } from '@supabase/supabase-js';

import type { SyncBackend } from './engine';
import type { LiveChannel } from './live';
import type { FeedPage, UploadAnswer } from './protocol';

/**
 * Transaction contention the server reports instead of waiting without bound:
 * a lock wait timeout, a serialization failure or a deadlock. The operation
 * is idempotent, so it is retried, a bounded number of times.
 */
const CONTENTION = new Set(['55P03', '40001', '40P01']);
const CONTENTION_ATTEMPTS = 3;

async function call<T>(supabase: SupabaseClient, operation: string, args: Record<string, unknown>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const { data, error } = await supabase.rpc(operation, args);
    if (!error) return data as T;
    if (!CONTENTION.has(error.code) || attempt >= CONTENTION_ATTEMPTS) throw new Error(`${operation} failed: ${error.code}`);
  }
}

export function supabaseSyncBackend(supabase: SupabaseClient): SyncBackend {
  return {
    upload: (request) => call<UploadAnswer>(supabase, 'sync_upload_v1', { request }),
    feed: (after, pageSize) => call<FeedPage>(supabase, 'sync_feed_v1', { after, page_size: pageSize }),
  };
}

/** The account's private topic. Only the server sends on it. */
export function supabaseLiveChannel(supabase: SupabaseClient, accountId: string): LiveChannel {
  const channel = supabase.channel(`account:${accountId}`, { config: { private: true } });
  return {
    join(handlers) {
      channel
        .on('broadcast', { event: 'account-changed' }, () => handlers.hint())
        .on('broadcast', { event: 'live-holder' }, ({ payload }) => {
          const claim = (payload as { claim?: unknown } | undefined)?.claim;
          if (typeof claim === 'number') handlers.holder(claim);
        });
      // Private topics authorize with the session's current access token.
      void supabase.realtime.setAuth().then(
        () =>
          channel.subscribe((status) => {
            if (status === 'SUBSCRIBED') handlers.status('joined');
            else handlers.status('closed');
          }),
        () => handlers.status('closed'),
      );
    },
    claim: async () => (await call<{ claim: number }>(supabase, 'realtime_claim_v1', {})).claim,
    leave() {
      // Removing the last channel also closes the socket, so a device without
      // the live connection holds no Realtime connection at all.
      void supabase.removeChannel(channel);
    },
  };
}
