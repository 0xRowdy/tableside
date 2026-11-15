// The sync engine's backend and live channel over Supabase: the versioned
// operations (supabase/migrations, `sync_upload_v1`, `sync_feed_v1`,
// `realtime_claim_v1`) and the account's private Realtime topic.

import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

import type { SyncBackend } from './engine';
import type { LiveChannel } from './live';
import type { FeedPage, UploadAnswer } from './protocol';

/**
 * Transaction contention the server reports instead of waiting without bound:
 * a lock wait timeout, a serialization failure or a deadlock. The operations
 * are idempotent, so they are retried a bounded number of times, after a short pause.
 */
const CONTENTION = new Set(['55P03', '40001', '40P01']);
const CONTENTION_ATTEMPTS = 3;
const CONTENTION_PAUSE_MS = 100;

async function callOperation<T>(supabase: SupabaseClient, operation: string, args: Record<string, unknown>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const { data, error } = await supabase.rpc(operation, args);
    if (!error) return data as T;
    if (!CONTENTION.has(error.code) || attempt >= CONTENTION_ATTEMPTS) throw new Error(`${operation} failed: ${error.code}`);
    await new Promise((resolve) => setTimeout(resolve, CONTENTION_PAUSE_MS * attempt));
  }
}

export function supabaseSyncBackend(supabase: SupabaseClient): SyncBackend {
  return {
    upload: (request) => callOperation<UploadAnswer>(supabase, 'sync_upload_v1', { request }),
    feed: (after, pageSize) => callOperation<FeedPage>(supabase, 'sync_feed_v1', { after, page_size: pageSize }),
  };
}

/**
 * Connections to the account's private topic, one at a time. Only the server
 * sends on it. The client hands back a topic's channel until it has finished
 * leaving, so a new connection waits for the previous one to be gone.
 */
export function supabaseLiveChannels(supabase: SupabaseClient, accountId: string): () => LiveChannel {
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
      claim: async () => (await callOperation<{ claim: number }>(supabase, 'realtime_claim_v1', {})).claim,
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
