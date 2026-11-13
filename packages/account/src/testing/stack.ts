// The local Supabase stack (`supabase start` at the repository root), as seen
// by seam 2 scenarios: its endpoints, keys, and privileged checks a scenario
// makes about what exists on the server.

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { type SupabaseClient, createClient } from '@supabase/supabase-js';
import postgres from 'postgres';

export interface LocalStack {
  readonly url: string;
  readonly publishableKey: string;
  readonly mailUrl: string;
  /** Privileged SQL, for faults no client can cause (server clock, lifecycle states later tickets set). */
  readonly sql: postgres.Sql;
  /** A raw client calling the stack directly, with no Account service: the adversary's view. */
  rawClient(accessToken?: string): SupabaseClient;
  /** Moves an eligibility assertion's expiry into the past, as if its lifetime had run out on the server. */
  expireAssertion(assertion: string): Promise<void>;
  /** The Auth user for an address, or null when none exists. */
  authUserId(email: string): Promise<string | null>;
  /** The account signed in by an address, or null. */
  accountId(email: string): Promise<string | null>;
  accountCount(email: string): Promise<number>;
}

const repositoryRoot = fileURLToPath(new URL('../../../../', import.meta.url));

let stack: LocalStack | null = null;

/** The running local stack. Throws with the command to run when it isn't up. */
export function localStack(): LocalStack {
  if (stack) return stack;
  let status: string;
  try {
    status = execFileSync('supabase', ['status', '-o', 'env'], { cwd: repositoryRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    throw new Error('The local Supabase stack is not running. Start it from the repository root with `supabase start`.');
  }
  const env = Object.fromEntries(
    status
      .split('\n')
      .map((line) => /^([A-Z_]+)="(.*)"$/.exec(line))
      .filter((match): match is RegExpExecArray => match !== null)
      .map(([, key, value]) => [key, value]),
  );
  const need = (key: string): string => {
    const value = env[key];
    if (!value) throw new Error(`\`supabase status\` did not report ${key}.`);
    return value;
  };
  const sql = postgres(need('DB_URL'), { max: 2, idle_timeout: 1, onnotice: () => {} });
  const accountIds = (email: string) => sql<{ account_id: string }[]>`
    select a.account_id from public.accounts a join auth.users u on u.id = a.auth_user_id
    where lower(u.email) = lower(${email})`;
  const url = need('API_URL');
  const publishableKey = need('PUBLISHABLE_KEY');
  stack = {
    url,
    publishableKey,
    mailUrl: need('MAILPIT_URL'),
    sql,
    rawClient(accessToken) {
      return createClient(url, publishableKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        ...(accessToken ? { global: { headers: { Authorization: `Bearer ${accessToken}` } } } : {}),
      });
    },
    async expireAssertion(assertion) {
      await sql`update private.eligibility_assertions set expires_at = now() - interval '1 second'
        where token_hash = extensions.digest(${assertion}, 'sha256')`;
    },
    async authUserId(email) {
      const rows = await sql<{ id: string }[]>`select id from auth.users where lower(email) = lower(${email})`;
      return rows[0]?.id ?? null;
    },
    async accountId(email) {
      return (await accountIds(email))[0]?.account_id ?? null;
    },
    async accountCount(email) {
      return (await accountIds(email)).length;
    },
  };
  return stack;
}
