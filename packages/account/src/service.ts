// Spec 2 Modules

import { createAgeEligibility } from './account-service/age';
import { createContext } from './account-service/context';
import { createDeletion } from './account-service/deletion';
import { createDevices } from './account-service/devices';
import { createMethods } from './account-service/methods';
import { createAccountSession } from './account-service/session';
import { createSignIn } from './account-service/sign-in';
import {
  type AccountService,
  type AccountServiceOptions,
  type AccountSummary,
  type SignInMethod,
  type SyncStatus,
  NO_SYNC,
  opensOrdinaryAccess,
  opensRestrictedPaths,
} from './account-service/types';
import { ENVIRONMENT_HEADER } from './environment';
import { accountExport } from './export';
import { accountPrivacy } from './privacy';
import { accountRecords } from './sync/records';
import { prerequisitesOf } from './sync/registry';
import { isCurrency } from './values';

export * from './account-service/types';

const DEFAULT_CURRENCY = 'USD';

const isSignInMethod = (provider: unknown): provider is SignInMethod => provider === 'apple' || provider === 'google' || provider === 'email';

export function createAccountService(options: AccountServiceOptions): AccountService {
  const { backend } = options;
  const ctx = createContext(options);
  const session = createAccountSession(ctx);
  const age = createAgeEligibility(ctx, session);
  const signIn = createSignIn(ctx, session, age);
  const { freshAuthentication, signInMethods } = createMethods(ctx, signIn);

  const syncListeners = new Set<(status: SyncStatus) => void>();
  const syncStatus = (): SyncStatus => {
    const sync = session.sync;
    return sync ? { ...sync.engine.status, live: sync.session.isLive } : NO_SYNC;
  };
  session.onSyncChanged(() => {
    const status = syncStatus();
    for (const listener of syncListeners) listener(status);
  });

  const localSummary = async (): Promise<AccountSummary> => {
    const user = (await session.storedSession())?.user;
    const methods = (user?.identities ?? []).map((identity) => identity.provider).filter(isSignInMethod);
    return {
      email: user?.email ?? null,
      methods: [...new Set(methods)],
      currency: (await ctx.readRemembered())?.currency ?? DEFAULT_CURRENCY,
      currencyChangeable: null,
      devices: null,
    };
  };

  const rememberCurrency = (at: number, currency: string) =>
    ctx.writeCredentials(async () => {
      const remembered = await ctx.readRemembered();
      if (at === ctx.generation && remembered && !remembered.signedOut) await ctx.remember({ ...remembered, currency });
    });

  const service: AccountService = {
    get gate() {
      return ctx.gate;
    },
    subscribe: (listener) => ctx.subscribe(listener),
    onAccountSessionEnding: (handler) => session.onAccountSessionEnding(handler),

    ...age.api,
    ...signIn.api,
    resume: () => session.resume(),
    renew: () => session.renew(),
    signOut: () => session.signOut(),
    recover: () => session.recover(),

    async accountSummary() {
      if (!opensOrdinaryAccess(ctx.gate)) return null;
      const at = ctx.generation;
      let summary = await localSummary();
      try {
        const { data, error } = await (await ctx.connect()).rpc('account_summary_v1');
        const answer = parseSummary(error ? null : data);
        if (answer && at === ctx.generation) {
          summary = answer;
          await rememberCurrency(at, answer.currency);
        }
      } catch {
      }
      return at === ctx.generation && opensOrdinaryAccess(ctx.gate) ? summary : null;
    },

    async setAccountCurrency(currency) {
      if (!opensOrdinaryAccess(ctx.gate) || !isCurrency(currency)) return { status: 'failed' };
      const at = ctx.generation;
      try {
        const { data, error } = await (await ctx.connect()).rpc('set_account_currency_v1', { new_currency: currency });
        const status = (data as { status?: unknown } | null)?.status;
        if (error || (status !== 'changed' && status !== 'locked')) return { status: 'failed' };
        if (status === 'changed') await rememberCurrency(at, currency);
        return { status };
      } catch {
        return { status: 'failed' };
      }
    },

    sync: {
      get status() {
        return syncStatus();
      },
      subscribe(listener) {
        syncListeners.add(listener);
        return () => syncListeners.delete(listener);
      },
      reconcile: () => session.sync?.engine.reconcile('deliberate') ?? Promise.resolve(),
      retryRecord: (id) => session.sync?.engine.retryRecord(id) ?? Promise.resolve(),
      decideUnconfirmed: (id, decision) => session.sync?.engine.decideUnconfirmed(id, decision) ?? Promise.resolve(),
      downloadAllHistory: () => session.sync?.engine.downloadAllHistory() ?? Promise.resolve(),
      idle: () => session.sync?.engine.idle() ?? Promise.resolve(),
      async queue(recordType, payload) {
        const store = session.sync?.store;
        if (!store) return { status: 'refused', reason: 'no-account' };
        const type = ctx.registry.get(recordType);
        if (!type) return { status: 'refused', reason: 'unknown-type' };
        if (type.kind === 'server-authored-state') return { status: 'refused', reason: 'server-authored' };
        if (!type.isPayload(payload)) return { status: 'refused', reason: 'invalid-payload' };
        if (type.onlineOnly?.(payload)) return { status: 'refused', reason: 'online-only' };
        const queued = await store.queueUpload({
          id: `${type.name}/${ctx.randomHex(16)}`,
          recordType: type.name,
          item: type.identity.of(payload),
          payload,
          dependencies: prerequisitesOf(ctx.registry, type, payload, await store.readUploadQueue()),
          positioned: type.ordering === 'per-device',
          purges: type.purges?.(payload) ?? null,
        });
        return { status: 'queued', id: queued.id, ...(queued.position !== undefined ? { position: queued.position } : {}) };
      },
      async countWaiting() {
        try {
          return (await session.sync?.store.readUploadQueue())?.length ?? 0;
        } catch {
          return 0;
        }
      },
    },

    records: accountRecords(() => session.sync, ctx.registry),
    privacy: accountPrivacy({
      session: () => session.sync,
      queue: (recordType, payload) => service.sync.queue(recordType, payload),
      gate: () => ctx.gate,
      newChoiceId: () => ctx.randomHex(16),
    }),
    freshAuthentication,
    signInMethods,
    devices: createDevices(ctx),
    export: accountExport({
      operation: (name) => ctx.operation(name, undefined, 'restricted'),
      download: (path) =>
        ctx.withSessionToken('restricted', (token) =>
          options.fetch(`${backend.url}/storage/v1/object/authenticated/account-exports/${path.split('/').map(encodeURIComponent).join('/')}`, {
            headers: { apikey: backend.publishableKey, [ENVIRONMENT_HEADER]: backend.name, authorization: `Bearer ${token}` },
          }),
        ),
      openStore: () => {
        const { gate } = ctx;
        const opened = session.opened;
        return opened && opensRestrictedPaths(gate) ? { accountId: gate.accountId, installationId: opened.session.installationId, store: opened.session.store } : null;
      },
      registry: ctx.registry,
      clock: options.clock,
    }),
    deletion: createDeletion(ctx, session),
  };
  return service;
}

function parseSummary(data: unknown): AccountSummary | null {
  const value = data as { email?: unknown; methods?: unknown; currency?: unknown; currency_changeable?: unknown; devices?: unknown } | null;
  if (!value || !isCurrency(value.currency) || !Array.isArray(value.methods) || typeof value.currency_changeable !== 'boolean' || typeof value.devices !== 'number') {
    return null;
  }
  return {
    email: typeof value.email === 'string' ? value.email : null,
    methods: (value.methods as unknown[]).filter(isSignInMethod),
    currency: value.currency,
    currencyChangeable: value.currency_changeable,
    devices: value.devices,
  };
}
