// Commands for seam 2 scenarios that call the operation API directly: every
// upload is a command in an installation's scope (spec 2, *Compaction and
// stale devices*), so a direct call needs a generation the server issued.

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Command } from '../sync/protocol';

export interface DirectCommands {
  readonly generation: number;
  /** The next position, from 1. */
  next(): Command;
}

/**
 * A new generation for `installation`, as a device holding none asks for one.
 * It replaces the installation's earlier generation: a simulated device on
 * that installation recovers (refreshes, reconciles, takes another) when it next uploads.
 */
export async function directCommands(raw: SupabaseClient, installation: string): Promise<DirectCommands> {
  const { data, error } = await raw.rpc('sync_scope_v1', { installation });
  const answer = data as { status?: string; generation?: number } | null;
  if (error || answer?.status !== 'scope' || typeof answer.generation !== 'number') throw new Error(`no command scope for ${installation}`);
  const { generation } = answer;
  let position = 0;
  return { generation, next: () => ({ generation, position: ++position }) };
}
