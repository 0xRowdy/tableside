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
  readonly sql: postgres.Sql;
  readonly environment: EnvironmentName;
  rawClient(accessToken?: string, environment?: EnvironmentName | null): SupabaseClient;
  serviceClient(): SupabaseClient;
  asEnvironment<T>(environment: EnvironmentName, scenario: () => Promise<T>): Promise<T>;
  expireAssertion(assertion: string): Promise<void>;
  authUserId(email: string): Promise<string | null>;
  accountId(email: string): Promise<string | null>;
  accountCount(email: string): Promise<number>;
  requestCode(body: Record<string, unknown>, environment?: EnvironmentName | null): Promise<{ readonly status: number; readonly body: unknown }>;
  resetCodeRequests(): Promise<void>;
  ageCodeRequests(email: string | null, seconds: number): Promise<void>;
  serverNow(): Promise<Date>;
  emailSends(since: Date): Promise<{ type: string; pacing: string; outcome: string }[]>;
  columns(table: string): Promise<string[]>;
  provisionReviewer(
    email: string,
    options?: { readonly key?: string; readonly environment?: EnvironmentName | null },
  ): Promise<{ readonly status: number; readonly body: { readonly status?: string; readonly credential?: string } | null }>;
  reviewerSignIn(body: Record<string, unknown>, environment?: EnvironmentName | null): Promise<{ readonly status: number; readonly body: unknown }>;
}

const repositoryRoot = fileURLToPath(new URL('../../../../', import.meta.url));

export const stackSlot = Number(process.env.TABLESIDE_STACK_SLOT ?? '0');

export const slotPort = (port: number): number => port + stackSlot * 100;

const stackWorkdir = stackSlot > 0 ? join(repositoryRoot, '.stacks', String(stackSlot)) : repositoryRoot;

let stack: LocalStack | null = null;

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
  const serviceRoleKey = need('SERVICE_ROLE_KEY');
  const callFunction = async (name: string, body: unknown, key: string, environment: EnvironmentName | null) => {
    const response = await fetch(`${url}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
        'content-type': 'application/json',
        ...(environment ? { [ENVIRONMENT_HEADER]: environment } : {}),
      },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json().catch(() => null) };
  };
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
    serviceClient() {
      return createClient(url, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { [ENVIRONMENT_HEADER]: 'local' } },
      });
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
    async serverNow() {
      const [row] = await sql<{ now: Date }[]>`select now()`;
      return row!.now;
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
    provisionReviewer(email, { key = serviceRoleKey, environment = 'local' } = {}) {
      return callFunction('provision-reviewer', { email }, key, environment);
    },
    reviewerSignIn(body, environment = 'local') {
      return callFunction('reviewer-sign-in', body, publishableKey, environment);
    },
  };
  return stack;
}
