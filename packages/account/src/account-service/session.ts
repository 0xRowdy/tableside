import { ELIGIBILITY_REFRESH_MS } from '../eligibility';
import { SyncEngine } from '../sync/engine';
import { SyncSession } from '../sync/session';
import type { SyncStore } from '../sync/store';
import { supabaseLiveChannels, supabaseSyncBackend } from '../sync/supabase';
import { instant } from '../values';

import type { ServiceContext } from './context';
import {
  type DeletedMarker,
  credentialsKey,
  deletedKey,
  forgetCredentials,
  installationSecretKey,
  parseDeleted,
  parseJson,
  statusKey,
} from './credentials';
import { type RememberedAccount, type RememberedEligibility, gateFor, rememberedAccountKey, withEligibility } from './remembered';
import {
  type RequiredCheck,
} from '../eligibility';
import { type RevokedBy, type SignOutResult, type VaultSession, isRestricted, opensOrdinaryAccess } from './types';

export interface OpenSession {
  readonly session: VaultSession;
  remembered: RememberedAccount;
  renewing: boolean;
  registered: boolean;
  serverCheck?: RequiredCheck | null;
  readonly stopWatch: () => void;
}

export interface OpenSync {
  readonly engine: SyncEngine;
  readonly session: SyncSession;
  readonly store: SyncStore;
}

export interface StoredSession {
  readonly access_token: string;
  readonly refresh_token: string;
  readonly expires_at: number;
  readonly expires_in: number;
  readonly user?: { readonly email?: string; readonly identities?: readonly { readonly provider?: string }[] };
}

export type AccountSession = ReturnType<typeof createAccountSession>;

export function createAccountSession(ctx: ServiceContext) {
  const { options, credentials } = ctx;
  const { backend } = options;
  const accountSessionEnding = new Set<() => Promise<void>>();
  const deletionMoved = new Set<() => void>();
  let refreshEligibility: () => Promise<void> = () => Promise.resolve();
  let opened: OpenSession | null = null;
  let sync: OpenSync | null = null;
  let signingOut: Promise<SignOutResult> | null = null;

  const syncChanged = new Set<() => void>();
  const notifySync = () => syncChanged.forEach((listener) => listener());

  ctx.onTokenRefreshed(() => sync?.session.credentialsChanged());

  const updateSync = async () => {
    if (!opensOrdinaryAccess(ctx.gate)) {
      if (!sync) return;
      sync.session.end();
      sync = null;
      notifySync();
      return;
    }
    if (sync || !opened?.registered) return;
    const current = opened;
    const supabase = await ctx.connect();
    if (opened !== current || sync || !opensOrdinaryAccess(ctx.gate)) return;
    const { store, installationId } = current.session;
    const engine = new SyncEngine({
      store,
      backend: supabaseSyncBackend(supabase, ctx.retryAfter),
      registry: ctx.registry,
      installationId,
      newOperationId: () => ctx.randomHex(16),
      clock: options.clock,
      random: () => uniformFromFourBytes(options.randomBytes(4)),
      metrics: ctx.metrics,
      ...(options.freeStorage ? { storage: options.freeStorage } : {}),
    });
    engine.onChange(notifySync);
    await engine.idle();
    if (opened !== current || sync || !opensOrdinaryAccess(ctx.gate)) return engine.stop();
    sync = {
      engine,
      store,
      session: new SyncSession(engine, store, options.device, supabaseLiveChannels(supabase, current.remembered.accountId, ctx.retryAfter), options.clock),
    };
    notifySync();
  };

  const rememberEligibility = async (current: OpenSession, next: RememberedEligibility) => {
    if (opened !== current) return;
    current.remembered = withEligibility(current.remembered, next);
    await ctx.writeCredentials(async () => {
      const stored = await ctx.readRemembered();
      if (opened === current) await ctx.remember(withEligibility(stored ?? current.remembered, next));
    });
    if (opened !== current) return;
    ctx.setGate(gateFor(current.remembered, current.renewing));
    await updateSync();
  };

  const endAccountSession = () => {
    ctx.nextGeneration();
    opened?.stopWatch();
    opened = null;
    sync?.session.end();
    sync = null;
    notifySync();
  };

  const openAccount = async (remembered: RememberedAccount, renewing = false) => {
    endAccountSession();
    const opening = await options.vault.open(remembered.accountId);
    if (opening.status === 'superseded') return;
    const { accountId } = remembered;
    if (opening.status === 'recovery-needed') return ctx.setGate({ state: 'recovery-needed', accountId });
    if (opening.status !== 'open') return ctx.setGate({ state: 'database-unavailable', accountId, reason: opening.status });
    const current: OpenSession = { session: opening.session, remembered, renewing, registered: false, stopWatch: watchEligibility() };
    opened = current;
    ctx.setGate(gateFor(remembered, renewing));
    await registerDevice(current);
    await updateSync();
  };

  const storedStatus = async (accountId: string): Promise<string | null> => {
    const stored = parseJson(await credentials.getItem(statusKey(backend.name))) as { accountId?: unknown; token?: unknown } | null;
    return stored?.accountId === accountId && typeof stored.token === 'string' ? stored.token : null;
  };

  const registerDevice = async (current: OpenSession): Promise<void> => {
    if (current.registered) return;
    const { accountId } = current.remembered;
    if (await storedStatus(accountId)) {
      if (opened === current) current.registered = true;
      return;
    }
    if (!(await canAskServer(current, { renew: false }))) return;
    const { installationId } = current.session;
    const secretKey = installationSecretKey(backend.name, installationId, accountId);
    try {
      let secret = await credentials.getItem(secretKey);
      if (!secret) {
        const created = ctx.randomHex(32);
        await ctx.writeCredentials(() => credentials.setItem(secretKey, created));
        secret = created;
      }
      const { platform, label } = options.deviceDescription();
      const supabase = await ctx.connect();
      const { data, error } = await supabase.rpc('register_device_v1', { installation: installationId, secret, platform, label });
      const answer = data as { status?: unknown; status_token?: unknown } | null;
      if (error || answer?.status !== 'registered' || typeof answer.status_token !== 'string') return;
      const token = answer.status_token;
      await ctx.writeCredentials(async () => {
        if (opened !== current) return;
        await credentials.setItem(statusKey(backend.name), JSON.stringify({ accountId, token }));
        current.registered = true;
      });
    } catch {
    }
  };

  const askLifecycle = async (token: string): Promise<{ status?: unknown; at?: unknown; by?: unknown; deadline?: unknown } | null> => {
    const response = await ctx.post('/rest/v1/rpc/lifecycle_status_v1', { token });
    const answer = (await response.json().catch(() => null)) as { status?: unknown; at?: unknown; by?: unknown; deadline?: unknown } | null;
    return response.ok ? answer : null;
  };

  const checkLifecycle = async (current: OpenSession): Promise<void> => {
    if (!options.device.online.current()) return;
    const token = await storedStatus(current.remembered.accountId);
    if (!token || opened !== current) return;
    try {
      const answer = await askLifecycle(token);
      if (!answer || opened !== current) return;
      if (answer.status === 'deleted') {
        await eraseDeleted(current, token);
      } else if (answer.status === 'revoked') {
        await lockRevoked(current, { at: instant(answer.at) ?? options.clock(), by: answer.by === 'provider' ? 'provider' : 'device' });
      } else if (answer.status === 'deletion-scheduled') {
        const deadline = instant(answer.deadline);
        if (deadline !== null) await rememberDeletion(current, deadline);
      } else if (answer.status === 'active') {
        await rememberDeletion(current, undefined);
      }
    } catch {
    }
  };

  const rememberDeletion = async (current: OpenSession, deadline: number | undefined): Promise<void> => {
    if (opened !== current || current.remembered.deletionDeadline === deadline) return;
    deletionMoved.forEach((moved) => moved());
    const apply = (base: RememberedAccount): RememberedAccount => ({ ...base, deletionDeadline: deadline });
    current.remembered = apply(current.remembered);
    await ctx.writeCredentials(async () => {
      const stored = await ctx.readRemembered();
      if (opened === current) await ctx.remember(apply(stored ?? current.remembered));
    });
    if (opened !== current) return;
    ctx.setGate(gateFor(current.remembered, current.renewing));
    await updateSync();
  };

  const endingHandlers = async () => {
    for (const handler of [...accountSessionEnding]) await handler().catch(() => undefined);
  };

  const lockRevoked = async (current: OpenSession, revoked: { readonly at: number; readonly by: RevokedBy }): Promise<void> => {
    if (signingOut) return;
    const { accountId } = current.remembered;
    await endingHandlers();
    if (opened !== current || signingOut) return;
    await closeAccountSession(accountId, revoked);
    ctx.setGate({ state: 'revoked', accountId, revokedAt: revoked.at, by: revoked.by });
  };

  // Spec 2 Reconciliation
  const eraseDeleted = async (current: OpenSession, token: string | null): Promise<void> => {
    if (signingOut || opened !== current) return;
    const marker = { accountId: current.remembered.accountId, token };
    await ctx.writeCredentials(() => credentials.setItem(deletedKey(backend.name), JSON.stringify(marker)));
    await endingHandlers();
    if (opened !== current) return;
    deletionMoved.forEach((moved) => moved());
    endAccountSession();
    await finishErase(marker);
    ctx.setGate({ state: 'deleted' });
  };

  const finishErase = async (marker: DeletedMarker & { readonly accountId: string }): Promise<void> => {
    const { accountId } = marker;
    await options.vault.erase(accountId);
    const appDataErased = options.eraseAppData ? await options.eraseAppData(accountId).then(() => true, () => false) : true;
    await ctx.writeCredentials(async () => {
      if ((await ctx.readRemembered())?.accountId === accountId) await credentials.removeItem(rememberedAccountKey(backend.name));
      await credentials.removeItem(credentialsKey(backend.name));
      await credentials.removeItem(statusKey(backend.name));
      await forgetCredentials(options.credentials, backend.name, (name) => name.includes(accountId));
      await credentials.setItem(deletedKey(backend.name), JSON.stringify(appDataErased ? { token: marker.token } : marker));
    });
  };

  const readDeleted = async (): Promise<DeletedMarker | null> => parseDeleted(await credentials.getItem(deletedKey(backend.name)));

  // #104
  const closeAccountSession = async (accountId: string, revoked?: RememberedAccount['revoked']): Promise<void> => {
    endAccountSession();
    await options.vault.close();
    await ctx.writeCredentials(async () => {
      const remembered = await ctx.readRemembered();
      if (remembered) await ctx.remember({ ...remembered, accountId, signedOut: true, revoked });
      await credentials.removeItem(credentialsKey(backend.name));
      if (!revoked) await credentials.removeItem(statusKey(backend.name));
    });
  };

  const eraseIfDeletedWhileLocked = async (accountId: string): Promise<boolean> => {
    if (!options.device.online.current()) return false;
    const token = await storedStatus(accountId);
    if (!token) return false;
    const answer = await askLifecycle(token).catch(() => null);
    if (answer?.status !== 'deleted') return false;
    const marker = { accountId, token };
    await ctx.writeCredentials(() => credentials.setItem(deletedKey(backend.name), JSON.stringify(marker)));
    await finishErase(marker);
    ctx.setGate({ state: 'deleted' });
    return true;
  };

  const watchEligibility = (): (() => void) => {
    const { device } = options;
    const refresh = () => {
      if (device.foreground.current() && device.online.current()) void refreshEligibility().catch(() => undefined);
    };
    const stops = [
      device.foreground.subscribe((foreground) => foreground && refresh()),
      device.online.subscribe((online) => online && refresh()),
      device.every(ELIGIBILITY_REFRESH_MS, refresh),
    ];
    return () => stops.forEach((stop) => stop());
  };

  const storedSession = async (): Promise<StoredSession | null> => {
    const parsed = parseJson(await credentials.getItem(credentialsKey(backend.name))) as Partial<StoredSession> | null;
    return parsed && typeof parsed.refresh_token === 'string' && typeof parsed.expires_at === 'number' ? (parsed as StoredSession) : null;
  };

  const renewSession = async (current: OpenSession): Promise<void> => {
    if (!current.renewing) return;
    const session = await storedSession();
    if (!session) return;
    try {
      const response = await ctx.post('/auth/v1/token?grant_type=refresh_token', { refresh_token: session.refresh_token });
      if (!response.ok) {
        await response.arrayBuffer();
        await checkLifecycle(current);
        return;
      }
      const renewed = (await response.json()) as StoredSession;
      const expiresAt = Math.floor(options.clock() / 1000) + renewed.expires_in;
      let applied = false;
      await ctx.writeCredentials(async () => {
        if (opened !== current) return;
        await credentials.setItem(credentialsKey(backend.name), JSON.stringify({ ...renewed, expires_at: expiresAt }));
        applied = true;
      });
      if (!applied || opened !== current) return;
      current.renewing = false;
      ctx.setGate(gateFor(current.remembered, false));
      sync?.session.credentialsChanged();
      await registerDevice(current);
      await updateSync();
    } catch {
    }
  };

  const canAskServer = async (current: OpenSession, { renew }: { readonly renew: boolean }): Promise<boolean> => {
    if (!options.device.online.current()) return false;
    if (renew) await renewSession(current);
    return opened === current && !current.renewing;
  };

  const endServerSession = async (session: StoredSession): Promise<boolean> => {
    try {
      let accessToken = session.access_token;
      if (session.expires_at * 1000 <= options.clock()) {
        const renewal = await ctx.post('/auth/v1/token?grant_type=refresh_token', { refresh_token: session.refresh_token });
        if (!renewal.ok) {
          await renewal.arrayBuffer().catch(() => undefined);
          return false;
        }
        accessToken = ((await renewal.json()) as StoredSession).access_token;
      }
      const response = await ctx.post('/auth/v1/logout?scope=local', {}, { authorization: `Bearer ${accessToken}` });
      await response.arrayBuffer().catch(() => undefined);
      return response.ok;
    } catch {
      return false;
    }
  };

  return {
    get opened() {
      return opened;
    },
    get sync() {
      return sync;
    },
    onSyncChanged: (listener: () => void) => void syncChanged.add(listener),
    onDeletionMoved: (listener: () => void) => void deletionMoved.add(listener),
    setRefresh(refresh: () => Promise<void>) {
      refreshEligibility = refresh;
    },
    onAccountSessionEnding(handler: () => Promise<void>) {
      accountSessionEnding.add(handler);
      return () => accountSessionEnding.delete(handler);
    },
    openAccount,
    registerDevice,
    storedStatus,
    storedSession,
    checkLifecycle,
    rememberDeletion,
    rememberEligibility,
    eraseDeleted,
    readDeleted,
    finishErase,
    canAskServer,
    updateSync,

    async resume(): Promise<{ readonly status: 'resumed' | 'signed-out' | 'deleted' | 'no-account' }> {
      const { gate } = ctx;
      if (gate.state === 'signed-out' || gate.state === 'revoked') return { status: 'signed-out' };
      if (gate.state === 'deleted') return { status: 'deleted' };
      if (gate.state !== 'no-account') return { status: 'resumed' };
      await ctx.connect();
      const deleted = await readDeleted();
      if (deleted) {
        if (deleted.accountId) await finishErase({ ...deleted, accountId: deleted.accountId });
        ctx.setGate({ state: 'deleted' });
        return { status: 'deleted' };
      }
      const remembered = await ctx.readRemembered();
      if (remembered?.signedOut) {
        const { accountId, revoked } = remembered;
        if (revoked && (await eraseIfDeletedWhileLocked(accountId))) return { status: 'deleted' };
        ctx.setGate(revoked ? { state: 'revoked', accountId, revokedAt: revoked.at, by: revoked.by } : { state: 'signed-out', accountId });
        return { status: 'signed-out' };
      }
      const session = await storedSession();
      if (!remembered || !session) return { status: 'no-account' };
      await openAccount(remembered, session.expires_at * 1000 <= options.clock());
      if (options.device.foreground.current() && options.device.online.current()) void refreshEligibility().catch(() => undefined);
      return { status: 'resumed' };
    },

    async renew() {
      if (opened) await renewSession(opened);
    },

    async recover(): Promise<{ readonly status: 'sign-in-needed' | 'failed' }> {
      const { gate } = ctx;
      if (gate.state !== 'recovery-needed' || signingOut) return { status: 'failed' };
      try {
        await options.vault.recover(gate.accountId);
      } catch {
        return { status: 'failed' };
      }
      if (ctx.gate !== gate) return { status: 'failed' };
      await this.signOut();
      return { status: 'sign-in-needed' };
    },

    signOut(): Promise<SignOutResult> {
      if (signingOut) return signingOut;
      const { gate } = ctx;
      const unopened = gate.state === 'recovery-needed' || gate.state === 'database-unavailable';
      if (!opensOrdinaryAccess(gate) && !isRestricted(gate) && !unopened) return Promise.resolve({ status: 'not-signed-in' });
      const { accountId } = gate;
      signingOut = (async (): Promise<SignOutResult> => {
        await endingHandlers();
        const session = await storedSession();
        await closeAccountSession(accountId);
        ctx.setGate({ state: 'signed-out', accountId });
        return { status: 'signed-out', serverSessionEnded: session ? await endServerSession(session) : false };
      })().finally(() => {
        signingOut = null;
      });
      return signingOut;
    },
  };
}

const uniformFromFourBytes = (bytes: Uint8Array): number => (((bytes[0]! << 24) | (bytes[1]! << 16) | (bytes[2]! << 8) | bytes[3]!) >>> 0) / 2 ** 32;
