// The local Supabase stack (`supabase start` at the repository root), as seen
// by seam 2 scenarios: its endpoints, keys, and privileged checks a scenario
// makes about what exists on the server.

import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { type SupabaseClient, createClient } from '@supabase/supabase-js';
import postgres from 'postgres';

import { ENVIRONMENT_HEADER, type EnvironmentName } from '../environment';

export interface LocalStack {
  readonly url: string;
  readonly publishableKey: string;
  readonly mailUrl: string;
  /** Privileged SQL, for faults no client can cause (server clock, lifecycle states later tickets set). */
  readonly sql: postgres.Sql;
  /** The backend environment a local stack serves (supabase/seed/local.sql). */
  readonly environment: EnvironmentName;
  /**
   * A raw client calling the stack directly, with no Account service: the
   * adversary's view. It names the stack's environment on every request unless
   * told to name another, or none (null).
   */
  rawClient(accessToken?: string, environment?: EnvironmentName | null): SupabaseClient;
  /**
   * Runs `scenario` with the stack serving another environment, as if it were
   * that environment's project, then restores it. Privileged: no client can.
   */
  asEnvironment<T>(environment: EnvironmentName, scenario: () => Promise<T>): Promise<T>;
  /** Moves an eligibility assertion's expiry into the past, as if its lifetime had run out on the server. */
  expireAssertion(assertion: string): Promise<void>;
  /** The Auth user for an address, or null when none exists. */
  authUserId(email: string): Promise<string | null>;
  /** The account signed in by an address, or null. */
  accountId(email: string): Promise<string | null>;
  accountCount(email: string): Promise<number>;
  /**
   * Calls the request-code function directly, with no Account service: the
   * adversary's view. It names the stack's environment unless told to name
   * another, or none (null).
   */
  requestCode(body: Record<string, unknown>, environment?: EnvironmentName | null): Promise<{ readonly status: number; readonly body: unknown }>;
  /** Clears every code-request window, as if an hour had passed for every address and network. */
  resetCodeRequests(): Promise<void>;
  /** Moves an address's code requests (or, with null, everyone's) back in time, as if that long had passed on the server. */
  ageCodeRequests(email: string | null, seconds: number): Promise<void>;
  /** The send log since the scenario began: each entry's type, pacing and outcome, oldest first. */
  emailSends(since: Date): Promise<{ type: string; pacing: string; outcome: string }[]>;
  /** The columns a table holds, to check what it can record. */
  columns(table: string): Promise<string[]>;
}

const repositoryRoot = fileURLToPath(new URL('../../../../', import.meta.url));

/**
 * The checkout's stack slot (`TABLESIDE_STACK_SLOT`, default 0). Slot N runs
 * the generated project in `.stacks/<N>` with every port moved up by N * 100,
 * so worktrees can run stacks side by side (`scripts/stack.mjs`).
 */
export const stackSlot = Number(process.env.TABLESIDE_STACK_SLOT ?? '0');

/** A port from supabase/config.toml, as this checkout's slot runs it. */
export const slotPort = (port: number): number => port + stackSlot * 100;

const stackWorkdir = stackSlot > 0 ? join(repositoryRoot, '.stacks', String(stackSlot)) : repositoryRoot;

let stack: LocalStack | null = null;

/** The running local stack. Throws with the command to run when it isn't up. */
export function localStack(): LocalStack {
  if (stack) return stack;
  let status: string;
  try {
    status = execFileSync('supabase', ['status', '-o', 'env', '--workdir', stackWorkdir], { cwd: repositoryRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    throw new Error(`The local Supabase stack (slot ${stackSlot}) is not running. Start it from the repository root with \`pnpm stack start\`.`);
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
    environment: 'local',
    rawClient(accessToken, environment = 'local') {
      const headers: Record<string, string> = {
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(environment ? { [ENVIRONMENT_HEADER]: environment } : {}),
      };
      return createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers } });
    },
    async asEnvironment(environment, scenario) {
      await sql`update private.deployment set environment = ${environment}`;
      try {
        return await scenario();
      } finally {
        await sql`update private.deployment set environment = 'local'`;
      }
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
    async requestCode(body, environment = 'local') {
      const response = await fetch(`${url}/functions/v1/request-code`, {
        method: 'POST',
        headers: { apikey: publishableKey, 'content-type': 'application/json', ...(environment ? { [ENVIRONMENT_HEADER]: environment } : {}) },
        body: JSON.stringify(body),
      });
      return { status: response.status, body: await response.json().catch(() => null) };
    },
    async resetCodeRequests() {
      await sql`delete from private.code_requests`;
    },
    async ageCodeRequests(email, seconds) {
      await sql`update private.code_requests set requested_at = requested_at - make_interval(secs => ${seconds})
        where ${email}::text is null or address_hash = extensions.digest(lower(btrim(${email})), 'sha256')`;
    },
    async emailSends(since) {
      return sql<{ type: string; pacing: string; outcome: string }[]>`
        select type, pacing, outcome from private.email_sends where sent_at >= ${since} order by id`;
    },
    async columns(table) {
      const [schema, name] = table.split('.');
      const rows = await sql<{ column_name: string }[]>`
        select column_name from information_schema.columns where table_schema = ${schema!} and table_name = ${name!} order by ordinal_position`;
      return rows.map((row) => row.column_name);
    },
  };
  return stack;
}
