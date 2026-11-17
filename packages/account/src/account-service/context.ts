import { type SupabaseClient, createClient } from '@supabase/supabase-js';

import { backendPost } from '../backend-request';
import { ENVIRONMENT_HEADER } from '../environment';
import { type MetricsSender, createMetricsSender, discardMetrics } from '../metrics';
import { hex } from '../values';
import { type RecordType, recordTypes } from '../sync/registry';
import { RetryAfterWatch } from '../sync/supabase';

import { credentialsKey, namespacedCredentials, removeRetiredEnvironments } from './credentials';
import { type RememberedAccount, parseRemembered, rememberedAccountKey } from './remembered';
import { type AccessPath, type AccountGate, type AccountServiceOptions, type CredentialStorage, opensOrdinaryAccess, opensRestrictedPaths } from './types';

export interface PlayerAnswer {
  readonly code: number;
  readonly status: string | undefined;
  readonly retryAfter?: unknown;
  readonly body: Record<string, unknown> | null;
}

export interface ServiceContext {
  readonly options: AccountServiceOptions;
  readonly registry: ReadonlyMap<string, RecordType>;
  readonly credentials: CredentialStorage;
  readonly retryAfter: RetryAfterWatch;
  readonly metrics: MetricsSender;
  connect(): Promise<SupabaseClient>;
  post(path: string, body: unknown, headers?: Record<string, string>): Promise<Response>;
  authRequest(method: 'PUT' | 'POST', path: string, body: unknown, token?: string): Promise<{ readonly ok: boolean; readonly body: Record<string, unknown> | null }>;
  onTokenRefreshed(listener: () => void): void;

  readonly gate: AccountGate;
  setGate(next: AccountGate): void;
  subscribe(listener: (gate: AccountGate) => void): () => void;
  readonly generation: number;
  nextGeneration(): void;

  allows(path: AccessPath): boolean;
  bearer(): Promise<string | null>;
  withSessionToken(path: AccessPath, send: (token: string) => Promise<Response>): Promise<Response | null>;
  actAsPlayer(name: string, body: unknown, path?: AccessPath): Promise<PlayerAnswer | null>;
  operation(name: string, args?: Record<string, unknown>, path?: AccessPath): Promise<unknown>;

  writeCredentials(write: () => Promise<void>): Promise<void>;
  remember(account: RememberedAccount): Promise<void>;
  readRemembered(): Promise<RememberedAccount | null>;
  randomHex(count: number): string;
}

export function createContext(options: AccountServiceOptions): ServiceContext {
  const { backend } = options;
  const credentials = namespacedCredentials(options.credentials, backend.name);
  const retryAfter = new RetryAfterWatch(options.clock);
  const refreshed = new Set<() => void>();
  let client: Promise<SupabaseClient> | null = null;
  const connect = (): Promise<SupabaseClient> =>
    (client ??= (async () => {
      await removeRetiredEnvironments(options);
      const created = createClient(backend.url, backend.publishableKey, {
        global: { fetch: retryAfter.wrap(options.fetch), headers: { [ENVIRONMENT_HEADER]: backend.name } },
        auth: {
          storage: credentials,
          storageKey: credentialsKey(backend.name),
          persistSession: true,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        ...(options.webSocket ? { realtime: { transport: options.webSocket } } : {}),
      });
      created.auth.onAuthStateChange((event) => {
        if (event === 'TOKEN_REFRESHED') for (const listener of refreshed) listener();
      });
      return created;
    })().catch((error: unknown) => {
      client = null;
      throw error;
    }));

  const headers = (extra: Record<string, string> = {}) => ({
    apikey: backend.publishableKey,
    [ENVIRONMENT_HEADER]: backend.name,
    'content-type': 'application/json',
    ...extra,
  });

  const listeners = new Set<(gate: AccountGate) => void>();
  let gate: AccountGate = { state: 'no-account' };
  let generation = 0;
  let credentialWrites: Promise<unknown> = Promise.resolve();

  const context: ServiceContext = {
    options,
    registry: options.recordTypes ?? recordTypes,
    credentials,
    retryAfter,
    metrics: createMetricsSender({ gate: () => gate, sink: options.metrics ?? discardMetrics }),
    connect,
    async post(path, body, extra = {}) {
      await connect();
      return backendPost(options.fetch, backend, path, body, extra);
    },
    async authRequest(method, path, body, token) {
      await connect();
      const response = await options.fetch(`${backend.url}/auth/v1${path}`, {
        method,
        headers: headers(token ? { authorization: `Bearer ${token}` } : {}),
        body: JSON.stringify(body),
      });
      return { ok: response.ok, body: (await response.json().catch(() => null)) as Record<string, unknown> | null };
    },
    onTokenRefreshed: (listener) => void refreshed.add(listener),

    get gate() {
      return gate;
    },
    setGate(next) {
      if (JSON.stringify(next) === JSON.stringify(gate)) return;
      gate = next;
      for (const listener of listeners) listener(next);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    get generation() {
      return generation;
    },
    nextGeneration: () => void generation++,

    allows: (path) => (path === 'ordinary' ? opensOrdinaryAccess(gate) : opensRestrictedPaths(gate)),
    bearer: async () => (await (await connect()).auth.getSession()).data.session?.access_token ?? null,
    async withSessionToken(path, send) {
      if (!context.allows(path)) return null;
      const at = generation;
      try {
        const token = await context.bearer();
        if (!token) return null;
        const response = await send(token);
        if (at === generation) return response;
        await response.body?.cancel();
        return null;
      } catch {
        return null;
      }
    },
    async actAsPlayer(name, body, path = 'ordinary') {
      const response = await context.withSessionToken(path, (token) => context.post(`/functions/v1/${name}`, body, { authorization: `Bearer ${token}` }));
      if (!response) return null;
      const answer = (await response.json().catch(() => null)) as { status?: string; retryAfter?: unknown } | null;
      return { code: response.status, status: answer?.status, retryAfter: answer?.retryAfter, body: answer };
    },
    async operation(name, args, path = 'ordinary') {
      if (!context.allows(path)) return null;
      const at = generation;
      try {
        const { data, error } = await (await connect()).rpc(name, args);
        return error || at !== generation ? null : data;
      } catch {
        return null;
      }
    },

    writeCredentials(write) {
      const next = credentialWrites.then(write);
      credentialWrites = next.catch(() => undefined);
      return next;
    },
    remember: (account) => credentials.setItem(rememberedAccountKey(backend.name), JSON.stringify(account)),
    readRemembered: async () => parseRemembered(await credentials.getItem(rememberedAccountKey(backend.name))),
    randomHex: (count) => hex(options.randomBytes(count)),
  };
  return context;
}
