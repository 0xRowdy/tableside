// Spec 2 Compaction and stale devices

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Command } from '../sync/protocol';

export interface DirectCommands {
  readonly generation: number;
  next(): Command;
}

export async function directCommands(raw: SupabaseClient, installation: string): Promise<DirectCommands> {
  const { data, error } = await raw.rpc('sync_scope_v1', { installation });
  const answer = data as { status?: string; generation?: number } | null;
  if (error || answer?.status !== 'scope' || typeof answer.generation !== 'number') throw new Error(`no command scope for ${installation}`);
  const { generation } = answer;
  let position = 0;
  return { generation, next: () => ({ generation, position: ++position }) };
}
