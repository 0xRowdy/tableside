// The account session on this installation: opening and closing the account's
// database through the vault, registering the session to the installation,
// what the server's lifecycle status says (revoked, deletion scheduled,
// deleted), renewal, sign-out and resuming. Its answers move the gate.

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

/**
 * The open account session: its database, what this device knows of the
 * account, and whether its token awaits renewal. A new object for each
 * session, so an answer for an earlier one (`opened !== current`) changes nothing.
 */
export interface OpenSession {
  readonly session: VaultSession;
  remembered: RememberedAccount;
  renewing: boolean;
  /** Whether this session is registered to this installation (and so may sync, and learn of its revocation). */
  registered: boolean;
  /** The required check the server last recorded for this installation in this session; undefined until it has. */
  serverCheck?: RequiredCheck | null;
  readonly stopWatch: () => void;
}

/** Synchronization for the open account session, while ordinary access is open. */
export interface OpenSync {
  readonly engine: SyncEngine;
  readonly session: SyncSession;
  readonly store: SyncStore;
}

/** Supabase's stored session: what resuming, renewal and sign-out read and write. */
export interface StoredSession {
  readonly access_token: string;
  readonly refresh_token: string;
  /** Seconds since the epoch. */
  readonly expires_at: number;
  readonly expires_in: number;
  readonly user?: { readonly email?: string; readonly identities?: readonly { readonly provider?: string }[] };
}

export type AccountSession = ReturnType<typeof createAccountSession>;

export function createAccountSession(ctx: ServiceContext) {
  const { options, credentials } = ctx;
  const { backend } = options;
  const accountSessionEnding = new Set<() => Promise<void>>();
  /** Runs when the server's deletion state moves, or the account session ends: an unanswered deletion request was for the account as it was. */
  const deletionMoved = new Set<() => void>();
  /** The eligibility refresh (the eligibility area's), run on the triggers watchEligibility sets. */
  let refreshEligibility: () => Promise<void> = () => Promise.resolve();
  let opened: OpenSession | null = null;
  let sync: OpenSync | null = null;
  let signingOut: Promise<SignOutResult> | null = null;

  const syncChanged = new Set<() => void>();
  const notifySync = () => syncChanged.forEach((listener) => listener());

  ctx.onTokenRefreshed(() => sync?.session.credentialsChanged());

  /**
   * Sync runs only while ordinary access is open, and once the session is
   * registered to this installation (the server takes uploads from the
   * caller's own installation only): a restricted account's database stays
   * open for its restricted paths only.
   */
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
    // The gate may have closed, or another session opened, meanwhile.
    if (opened !== current || sync || !opensOrdinaryAccess(ctx.gate)) return;
    const { store, installationId } = current.session;
    const engine = new SyncEngine({
      store,
      backend: supabaseSyncBackend(supabase, ctx.retryAfter),
      registry: ctx.registry,
      installationId,
      newOperationId: () => ctx.randomHex(16),
      clock: options.clock,
      random: () => uniform(options.randomBytes(4)),
      metrics: ctx.metrics,
      ...(options.freeStorage ? { storage: options.freeStorage } : {}),
    });
    engine.onChange(notifySync);
    // Its status read from the store first (the first download's progress among it), so it never shows a default.
    await engine.idle();
    // A sign-out, another sign-in or a closing gate while it read: not this one's to start.
    if (opened !== current || sync || !opensOrdinaryAccess(ctx.gate)) return engine.stop();
    sync = {
      engine,
      store,
      session: new SyncSession(engine, store, options.device, supabaseLiveChannels(supabase, current.remembered.accountId, ctx.retryAfter), options.clock),
    };
    notifySync();
  };

  /**
   * Keeps what this device knows of the open account's eligibility (with its
   * credentials, over whatever else is remembered, such as the currency) and
   * moves the gate.
   */
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

  /** Ends the open account session on this installation: answers for it touch nothing, and sync stops. */
  const endAccountSession = () => {
    ctx.nextGeneration();
    opened?.stopWatch();
    opened = null;
    sync?.session.end();
    sync = null;
    notifySync();
  };

  /**
   * Opens the account's database for a new account session and moves the gate
   * (starting sync when ordinary access is open). Nothing changes when a later
   * sign-in overtook this one.
   */
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

  /** This session's status credential, kept with the credentials while the session lasts. */
  const storedStatus = async (accountId: string): Promise<string | null> => {
    const stored = parseJson(await credentials.getItem(statusKey(backend.name))) as { accountId?: unknown; token?: unknown } | null;
    return stored?.accountId === accountId && typeof stored.token === 'string' ? stored.token : null;
  };

  /**
   * Registers this session to this installation, once per session: online,
   * with an unexpired token. The installation's secret (kept across sign-outs)
   * proves it is the installation that first registered for the account. A
   * failure leaves it unregistered, and the next refresh tries again.
   */
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
      // The secret is this device's before the server hears it, so a lost answer or a kill never strands the installation.
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
      // Offline, or the answer was lost: the next refresh registers.
    }
  };

  /** The lifecycle status for a status credential, or null when no answer came. */
  const askLifecycle = async (token: string): Promise<{ status?: unknown; at?: unknown; by?: unknown; deadline?: unknown } | null> => {
    const response = await ctx.post('/rest/v1/rpc/lifecycle_status_v1', { token });
    const answer = (await response.json().catch(() => null)) as { status?: unknown; at?: unknown; by?: unknown; deadline?: unknown } | null;
    return response.ok ? answer : null;
  };

  /**
   * Asks the server, with this session's status credential, what became of the
   * account and session. Only its answers move the gate: to Revoked, to
   * Deletion scheduled (with the deadline), back from it once deletion was
   * canceled (an active answer), or to Deleted, which erases the account here.
   * A timeout, a lost answer, an expired token or a refused renewal never does.
   */
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
      // Offline or the answer was lost: nothing is known.
    }
  };

  /**
   * Keeps what the server said of the account's deletion (scheduled with
   * `deadline`, or not scheduled) and moves the gate. Becoming Deletion
   * scheduled closes ordinary access, so an unfinished practice session
   * suspends at once (the app follows the gate) and sync stops; the database
   * stays open for the restricted paths. Not scheduled reopens the account.
   */
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

  /** Runs the session-ending handlers (an open practice session suspends) while the database is still open. */
  const endingHandlers = async () => {
    for (const handler of [...accountSessionEnding]) await handler().catch(() => undefined);
  };

  /**
   * The server confirmed this session was revoked: an open practice session
   * suspends at once (as on sign-out), then the database closes, kept with its
   * key, and the credentials go. A fresh sign-in to the same account reopens it.
   */
  const lockRevoked = async (current: OpenSession, revoked: { readonly at: number; readonly by: RevokedBy }): Promise<void> => {
    if (signingOut) return;
    const { accountId } = current.remembered;
    await endingHandlers();
    if (opened !== current || signingOut) return;
    await closeAccountSession(accountId, revoked);
    ctx.setGate({ state: 'revoked', accountId, revokedAt: revoked.at, by: revoked.by });
  };

  /**
   * The server confirmed the account's permanent deletion: stop and erase
   * (spec 2, *Reconciliation*). The session-ending handlers run first (an
   * open practice session stops), then the account session ends, without
   * waiting for anything else. A marker written first finishes an interrupted
   * erase at the next launch. Only this account's data goes: another account's
   * database on this installation is never touched.
   */
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

  /**
   * Erases a deleted account's data on this installation: its database (with
   * pending uploads and staged files) and key, the app's own copies, then its
   * credentials (Auth's session, the remembered account, every entry named
   * for it, such as the installation's secret). Only the status credential
   * stays, in the marker. If the app's copies couldn't be erased, the marker
   * keeps the account, so the next launch tries again.
   */
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

  /** What this installation keeps of a deleted account: the marker, or null. */
  const readDeleted = async (): Promise<DeletedMarker | null> => parseDeleted(await credentials.getItem(deletedKey(backend.name)));

  /**
   * Locks the account on this installation, once the session-ending handlers
   * have run (sign-out or revocation): the account session ends, its database
   * closes, kept with its key, and its credentials go, all without the network.
   * A revoked session's status credential stays: the server keeps answering
   * it, so the next launch can still learn the account was deleted (#104).
   */
  const closeAccountSession = async (accountId: string, revoked?: RememberedAccount['revoked']): Promise<void> => {
    endAccountSession();
    await options.vault.close();
    await ctx.writeCredentials(async () => {
      const remembered = await ctx.readRemembered();
      // The lock first: a kill between the writes still reopens locked (an earlier revocation is no longer why).
      if (remembered) await ctx.remember({ ...remembered, accountId, signedOut: true, revoked });
      await credentials.removeItem(credentialsKey(backend.name));
      if (!revoked) await credentials.removeItem(statusKey(backend.name));
    });
  };

  /**
   * A revoked installation, launching online: asks with the status credential
   * it kept whether the account was deleted meanwhile, and erases it if so.
   * True when it did.
   */
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

  /** Refreshes eligibility on entering the foreground, on reconnection and every minute while foregrounded and connected. */
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

  /** Renews an expired token, once; a failure leaves it awaiting renewal, with access and records. */
  const renewSession = async (current: OpenSession): Promise<void> => {
    if (!current.renewing) return;
    const session = await storedSession();
    if (!session) return;
    try {
      const response = await ctx.post('/auth/v1/token?grant_type=refresh_token', { refresh_token: session.refresh_token });
      if (!response.ok) {
        await response.arrayBuffer();
        // A refused renewal proves nothing by itself; the server's status may (a revoked session).
        await checkLifecycle(current);
        return;
      }
      const renewed = (await response.json()) as StoredSession;
      const expiresAt = Math.floor(options.clock() / 1000) + renewed.expires_in;
      // A sign-out or another account while this was in flight: touch nothing.
      let applied = false;
      await ctx.writeCredentials(async () => {
        if (opened !== current) return;
        await credentials.setItem(credentialsKey(backend.name), JSON.stringify({ ...renewed, expires_at: expiresAt }));
        applied = true;
      });
      if (!applied || opened !== current) return;
      current.renewing = false;
      ctx.setGate(gateFor(current.remembered, false));
      // The live connection re-subscribes with the renewed token, as on Supabase's own refresh.
      sync?.session.credentialsChanged();
      await registerDevice(current);
      await updateSync();
    } catch {
      // Offline or the response was lost: still awaiting renewal.
    }
  };

  /**
   * Whether the server can be asked now: online, with a token that hasn't
   * expired (Supabase would otherwise try to renew it itself). The player's own
   * retry or answer renews an expired token first; background refreshes leave
   * renewal to its own trigger.
   */
  const canAskServer = async (current: OpenSession, { renew }: { readonly renew: boolean }): Promise<boolean> => {
    if (!options.device.online.current()) return false;
    if (renew) await renewSession(current);
    return opened === current && !current.renewing;
  };

  /**
   * Asks the server to end this session only (current-session scope). True
   * only when it confirmed. An expired access token (Renewal pending) is
   * renewed first, since the server refuses to end a session for it.
   */
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
    /** Called when sync starts, stops or its status changes. */
    onSyncChanged: (listener: () => void) => void syncChanged.add(listener),
    /** Called when the server's deletion state moves or the account session ends. */
    onDeletionMoved: (listener: () => void) => void deletionMoved.add(listener),
    /** The eligibility area's refresh, which the session's triggers run. */
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

    /** The app starting again (AccountService.resume). */
    async resume(): Promise<{ readonly status: 'resumed' | 'signed-out' | 'deleted' | 'no-account' }> {
      const { gate } = ctx;
      if (gate.state === 'signed-out' || gate.state === 'revoked') return { status: 'signed-out' };
      if (gate.state === 'deleted') return { status: 'deleted' };
      if (gate.state !== 'no-account') return { status: 'resumed' };
      // Removes a retired environment's namespace before reading any credentials.
      await ctx.connect();
      // A deleted account's erase finishes first, if a kill interrupted it.
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
      // Read straight from storage: Supabase's own read would try to renew an
      // expired token over the network, retrying for half a minute offline.
      const session = await storedSession();
      if (!remembered || !session) return { status: 'no-account' };
      await openAccount(remembered, session.expires_at * 1000 <= options.clock());
      // Signals refresh when online; offline the remembered state stands, with no deadline.
      if (options.device.foreground.current() && options.device.online.current()) void refreshEligibility().catch(() => undefined);
      return { status: 'resumed' };
    },

    async renew() {
      if (opened) await renewSession(opened);
    },

    /** Restores synced history into a fresh database (AccountService.recover). */
    async recover(): Promise<{ readonly status: 'sign-in-needed' | 'failed' }> {
      const { gate } = ctx;
      if (gate.state !== 'recovery-needed' || signingOut) return { status: 'failed' };
      try {
        await options.vault.recover(gate.accountId);
      } catch {
        return { status: 'failed' };
      }
      if (ctx.gate !== gate) return { status: 'failed' };
      // The fresh database is a new installation's: a new sign-in registers it (a session is bound to one installation).
      await this.signOut();
      return { status: 'sign-in-needed' };
    },

    /** Signs out of this installation only (AccountService.signOut). */
    signOut(): Promise<SignOutResult> {
      // A second tap while signing out joins the first.
      if (signingOut) return signingOut;
      const { gate } = ctx;
      // Also from a database that can't be opened here: Sign out, or use another account.
      const unopened = gate.state === 'recovery-needed' || gate.state === 'database-unavailable';
      if (!opensOrdinaryAccess(gate) && !isRestricted(gate) && !unopened) return Promise.resolve({ status: 'not-signed-in' });
      const { accountId } = gate;
      signingOut = (async (): Promise<SignOutResult> => {
        // An open practice session suspends while the database is still open.
        await endingHandlers();
        const session = await storedSession();
        await closeAccountSession(accountId);
        ctx.setGate({ state: 'signed-out', accountId });
        // Locally signed out already; the server learns only if it can be reached.
        return { status: 'signed-out', serverSessionEnded: session ? await endServerSession(session) : false };
      })().finally(() => {
        signingOut = null;
      });
      return signingOut;
    },
  };
}

/** Four random bytes as a uniform number in [0, 1). */
const uniform = (bytes: Uint8Array): number => (((bytes[0]! << 24) | (bytes[1]! << 16) | (bytes[2]! << 8) | bytes[3]!) >>> 0) / 2 ** 32;
