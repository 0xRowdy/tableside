// Account-service fakes for seam 3 screen tests: a scripted Account service
// with no network or storage, and the app account around it.

import type {
  AccountDeletion,
  AccountExport,
  AccountGate,
  AccountPrivacy,
  AccountRecords,
  AccountService,
  AccountSync,
  AgeAnswerResult,
  AccountSummary,
  AgeCheckResult,
  AgeRange,
  CancelDeletionResult,
  CodeIntent,
  CodeRequestResult,
  CodeVerificationResult,
  CurrencyChangeResult,
  DeletionProgress,
  DeletionStatus,
  DeletePermanentlyResult,
  DeviceEntry,
  DeviceSignOutResult,
  Devices,
  EmailChangeConfirmation,
  EmailChangeResult,
  EmailMethodResult,
  FreshAuthentication,
  FreshAuthenticationResult,
  IdentityProvider,
  LinkResult,
  LocalSupplement,
  RemoveMethodResult,
  SignInMethodEntry,
  SignInMethods,
  ProviderCreateResult,
  ProviderSignInResult,
  ReviewerSignInResult,
  ScheduleDeletionResult,
  ServerExport,
  ServerExportDownload,
  ServerExportRequest,
  SignOutResult,
} from '@tableside/account';
import { SUPPLEMENT_NOTICE, isRestricted, opensOrdinaryAccess, opensRestrictedPaths } from '@tableside/account';

import type { GameId } from '@/games';

import type { AppAccount } from '../app-account';
import type { ExportFile } from '../export-files';
import type { RestrictedPath } from '../RestrictedPaths';

export const FAKE_ACCOUNT_ID = 'account-1';

type Call =
  | { readonly method: 'answerAgeQuestion'; readonly range: AgeRange }
  | { readonly method: 'requestEmailCode'; readonly email: string; readonly intent: CodeIntent }
  | { readonly method: 'verifyEmailCode'; readonly email: string; readonly code: string }
  | { readonly method: 'signInAsReviewer'; readonly email: string; readonly credential: string }
  | { readonly method: 'setAccountCurrency'; readonly currency: string }
  | { readonly method: 'signInWithProvider'; readonly provider: IdentityProvider }
  | { readonly method: 'createWithProvider'; readonly provider: IdentityProvider; readonly sameIdentity: boolean }
  | { readonly method: 'resume' | 'renew' | 'signOut' | 'checkAge' | 'refreshEligibility' | 'downloadAllHistory' };

/** What the fake's Settings → Account shows unless a test changes it. */
export const FAKE_SUMMARY: AccountSummary = {
  email: 'player@example.com',
  methods: ['apple', 'email'],
  currency: 'USD',
  currencyChangeable: true,
  devices: 3,
};

/** The sign-in methods the fake's account has unless a test changes them: Apple (Hide My Email) and the email code. */
export const FAKE_METHODS: readonly SignInMethodEntry[] = [
  { id: 'method-apple', method: 'apple', email: 'x7k2@privaterelay.appleid.com' },
  { id: 'method-email', method: 'email', email: 'player@example.com' },
];

const DAY = 86_400_000;

/** The local supplement the fake builds unless a test changes it: one unsynced practice session, nothing else. */
export const FAKE_SUPPLEMENT: LocalSupplement = {
  format: 'tableside-local-supplement',
  version: 1,
  createdAt: '2026-11-15T12:00:00.000Z',
  account: 'account-1',
  installation: 'installation-1',
  notice: SUPPLEMENT_NOTICE,
  unsynced: [{ recordType: 'completed-practice-session', item: 'activity-1', installation: 'installation-1', revision: null, syncStatus: 'waiting', record: {} }],
  conflicts: [],
  unfinished: [],
};

/** The devices the fake's account is signed in on unless a test changes them: this iPhone (active now), an iPad (2 days ago) and a Pixel (3 months ago). */
export function fakeDevices(now = Date.now()): readonly DeviceEntry[] {
  return [
    { id: 'device-iphone', platform: 'ios', label: 'iPhone 15 · iOS 18', lastActiveAt: now, thisDevice: true },
    { id: 'device-ipad', platform: 'ios', label: 'iPad Air · iPadOS 18', lastActiveAt: now - 2 * DAY - 3_600_000, thisDevice: false },
    { id: 'device-pixel', platform: 'android', label: 'Pixel 8 · Android 15', lastActiveAt: now - 95 * DAY, thisDevice: false },
  ];
}

/** An Account service whose answers a test scripts. Unscripted calls succeed. */
export class FakeAccountService implements AccountService {
  private current: AccountGate = { state: 'no-account' };
  private readonly listeners = new Set<(gate: AccountGate) => void>();
  readonly calls: Call[] = [];
  /** Answers for the next calls, used in order. */
  readonly next: {
    age: AgeAnswerResult[];
    /** Platform age checks' answers; unscripted, the platform proves nothing ("question"). */
    check: AgeCheckResult[];
    code: CodeRequestResult[];
    verify: CodeVerificationResult[];
    signOut: SignOutResult[];
    currency: CurrencyChangeResult[];
    providerSignIn: ProviderSignInResult[];
    providerCreate: ProviderCreateResult[];
    reviewer: ReviewerSignInResult[];
  } = { age: [], check: [], code: [], verify: [], signOut: [], currency: [], providerSignIn: [], providerCreate: [], reviewer: [] };
  /** Whether the device offers a platform age check. */
  platformAgeCheck = false;
  /** What accountSummary() answers; a changed currency updates it. */
  summary: AccountSummary | null = FAKE_SUMMARY;
  /** How many saved records haven't synced. */
  waitingCount = 0;
  private readonly ending = new Set<() => Promise<void>>();

  constructor(
    /** The gate resume() reopens into: what this installation was signed in to. */
    private readonly stored: AccountGate = { state: 'no-account' },
  ) {}

  get gate() {
    return this.current;
  }

  readonly subscribe = (listener: (gate: AccountGate) => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Moves the gate, as the real service does when it learns something. */
  setGate(gate: AccountGate) {
    this.current = gate;
    for (const listener of this.listeners) listener(gate);
  }

  async resume() {
    this.calls.push({ method: 'resume' });
    if (this.stored.state === 'no-account') return { status: 'no-account' as const };
    this.setGate(this.stored);
    return { status: this.stored.state === 'signed-out' || this.stored.state === 'revoked' ? ('signed-out' as const) : ('resumed' as const) };
  }

  /** Like the real service: the session-ending handlers run first, then the gate is Signed out. */
  async signOut(): Promise<SignOutResult> {
    this.calls.push({ method: 'signOut' });
    const gate = this.current;
    if (!opensOrdinaryAccess(gate) && !isRestricted(gate)) return { status: 'not-signed-in' as const };
    for (const handler of [...this.ending]) await handler();
    this.setGate({ state: 'signed-out', accountId: gate.accountId });
    return this.next.signOut.shift() ?? { status: 'signed-out' as const, serverSessionEnded: true };
  }

  onAccountSessionEnding(handler: () => Promise<void>) {
    this.ending.add(handler);
    return () => {
      this.ending.delete(handler);
    };
  }

  async accountSummary() {
    return opensOrdinaryAccess(this.current) ? this.summary : null;
  }

  async setAccountCurrency(currency: string) {
    this.calls.push({ method: 'setAccountCurrency', currency });
    const result = this.next.currency.shift() ?? { status: 'changed' as const };
    if (result.status === 'changed' && this.summary) this.summary = { ...this.summary, currency };
    return result;
  }

  /** No synchronization runs in screen tests. */
  readonly sync: AccountSync = {
    status: { live: false, error: null, lastSyncedAt: null, uploads: [], update: null, history: { state: 'complete' }, download: { state: 'not-requested' } },
    subscribe: () => () => undefined,
    reconcile: async () => undefined,
    retryRecord: async () => undefined,
    decideUnconfirmed: async () => undefined,
    downloadAllHistory: async () => {
      this.calls.push({ method: 'downloadAllHistory' });
    },
    idle: async () => undefined,
    countWaiting: async () => this.waitingCount,
    queue: async () => ({ status: 'refused', reason: 'no-account' }),
  };

  /** The account's sign-in methods: list() answers them, and an unscripted link or removal changes them. Null: offline. */
  methods: readonly SignInMethodEntry[] | null = FAKE_METHODS;
  /** Answers for the next fresh-authentication and sign-in-method calls, used in order; unscripted ones succeed. */
  readonly methodsNext: {
    fresh: FreshAuthenticationResult[];
    freshCode: CodeRequestResult[];
    link: LinkResult[];
    emailMethodCode: (CodeRequestResult | { status: 'fresh-authentication-required' })[];
    emailMethod: EmailMethodResult[];
    remove: RemoveMethodResult[];
    changeEmail: EmailChangeResult[];
    confirmEmailChange: EmailChangeConfirmation[];
  } = { fresh: [], freshCode: [], link: [], emailMethodCode: [], emailMethod: [], remove: [], changeEmail: [], confirmEmailChange: [] };
  /** Each fresh-authentication and sign-in-method call, in order, as "name argument". */
  readonly methodCalls: string[] = [];

  readonly freshAuthentication: FreshAuthentication = {
    methods: async () => (opensRestrictedPaths(this.current) ? this.methods : null),
    withProvider: async (provider) => {
      this.methodCalls.push(`fresh ${provider}`);
      return this.methodsNext.fresh.shift() ?? { status: 'confirmed' };
    },
    requestCode: async () => {
      this.methodCalls.push('fresh code-request');
      return this.methodsNext.freshCode.shift() ?? { status: 'sent' };
    },
    withCode: async (code) => {
      this.methodCalls.push(`fresh code ${code}`);
      return this.methodsNext.fresh.shift() ?? { status: 'confirmed' };
    },
  };

  readonly signInMethods: SignInMethods = {
    list: async () => (opensOrdinaryAccess(this.current) ? this.methods : null),
    link: async (provider) => {
      this.methodCalls.push(`link ${provider}`);
      const result = this.methodsNext.link.shift() ?? { status: 'linked' as const };
      if (result.status === 'linked' && this.methods) this.methods = [...this.methods, { id: `method-${provider}`, method: provider, email: `${provider}@example.com` }];
      return result;
    },
    requestEmailMethodCode: async () => {
      this.methodCalls.push('email-method code-request');
      return this.methodsNext.emailMethodCode.shift() ?? { status: 'sent' };
    },
    confirmEmailMethod: async (code) => {
      this.methodCalls.push(`email-method code ${code}`);
      const result = this.methodsNext.emailMethod.shift() ?? { status: 'linked' as const };
      if (result.status === 'linked' && this.methods) this.methods = [...this.methods, { id: 'method-email', method: 'email', email: this.summary?.email ?? null }];
      return result;
    },
    remove: async (id) => {
      this.methodCalls.push(`remove ${id}`);
      const result = this.methodsNext.remove.shift() ?? { status: 'removed' as const };
      if (result.status === 'removed' && this.methods) this.methods = this.methods.filter((entry) => entry.id !== id);
      return result;
    },
    changeEmail: async (email) => {
      this.methodCalls.push(`change-email ${email}`);
      return this.methodsNext.changeEmail.shift() ?? { status: 'codes-sent' };
    },
    confirmEmailChange: async ({ currentCode, newCode }) => {
      this.methodCalls.push(`confirm-email-change ${currentCode} ${newCode}`);
      return this.methodsNext.confirmEmailChange.shift() ?? { status: 'changed' };
    },
  };

  /** The account's devices: list() answers them, and an unscripted sign-out removes them. Null: offline. */
  deviceEntries: readonly DeviceEntry[] | null = fakeDevices();
  /** Answers for the next device sign-outs, used in order; unscripted ones succeed. */
  readonly devicesNext: { signOut: DeviceSignOutResult[] } = { signOut: [] };
  /** Each device sign-out, in order, as "sign-out <id>" or "sign-out-others". */
  readonly deviceCalls: string[] = [];

  private signedOutDevices(keep: (entry: DeviceEntry) => boolean): DeviceSignOutResult {
    const result = this.devicesNext.signOut.shift();
    if (result) return result;
    const gone = (this.deviceEntries ?? []).filter((entry) => !keep(entry));
    this.deviceEntries = (this.deviceEntries ?? []).filter(keep);
    return { status: 'signed-out', devices: gone.length, email: this.summary?.email ?? null };
  }

  readonly devices: Devices = {
    list: async () => (opensOrdinaryAccess(this.current) ? this.deviceEntries : null),
    signOut: async (id) => {
      this.deviceCalls.push(`sign-out ${id}`);
      return this.signedOutDevices((entry) => entry.id !== id);
    },
    signOutOthers: async () => {
      this.deviceCalls.push('sign-out-others');
      return this.signedOutDevices((entry) => entry.thisDevice);
    },
  };

  /** The latest server export: what serverExport() answers, and what a request sets. Null: offline. */
  serverExportState: ServerExport | null = { state: 'none' };
  /** Answers for the next export requests and downloads, used in order; unscripted ones succeed. */
  readonly exportNext: { request: ServerExportRequest[]; download: ServerExportDownload[] } = { request: [], download: [] };
  /** What localSupplement() builds. */
  supplement: LocalSupplement | null = FAKE_SUPPLEMENT;
  /** Each export call, in order: "request", "download" or "supplement". */
  readonly exportCalls: string[] = [];

  readonly export: AccountExport = {
    serverExport: async () => (opensRestrictedPaths(this.current) ? this.serverExportState : null),
    requestServerExport: async () => {
      this.exportCalls.push('request');
      const result = this.exportNext.request.shift() ?? { status: 'requested' as const, export: { state: 'preparing' as const, requestedAt: Date.now() } };
      if (result.status === 'requested' || result.status === 'preparing') this.serverExportState = result.export;
      return result;
    },
    downloadServerExport: async () => {
      this.exportCalls.push('download');
      return this.exportNext.download.shift() ?? { status: 'downloaded', fileName: 'tableside-export-2026-11-15.zip', bytes: new Uint8Array([0x50, 0x4b, 0x05, 0x06]) };
    },
    localSupplement: async () => {
      this.exportCalls.push('supplement');
      return opensRestrictedPaths(this.current) ? this.supplement : null;
    },
  };

  /** What deletion.status() answers while the restricted paths are open. Null: offline. */
  deletionState: DeletionStatus | null = { status: 'none' };
  /** Answers for the next deletion calls, used in order; unscripted ones succeed. */
  readonly deletionNext: { schedule: ScheduleDeletionResult[]; cancel: CancelDeletionResult[]; deletePermanently: DeletePermanentlyResult[] } = {
    schedule: [],
    cancel: [],
    deletePermanently: [],
  };
  /** What deletion.status() answers once Deleted. Null: offline. */
  deletionProgress: DeletionProgress | null = null;
  /** Each deletion call, in order: "schedule", "cancel", "delete-permanently", "status" or "dismiss". */
  readonly deletionCalls: string[] = [];

  /** As the real service: a scheduling locks the gate with its deadline, and a cancel reopens the same account. */
  readonly deletion: AccountDeletion = {
    schedule: async () => {
      this.deletionCalls.push('schedule');
      const gate = this.current;
      const result = this.deletionNext.schedule.shift() ?? { status: 'scheduled' as const, deadline: Date.now() + 30 * DAY };
      if (result.status === 'scheduled' && 'accountId' in gate) {
        this.deletionState = { status: 'scheduled', deadline: result.deadline, scheduledAt: Date.now() };
        this.setGate({ state: 'deletion-scheduled', accountId: gate.accountId, deadline: result.deadline });
      }
      return result;
    },
    cancel: async () => {
      this.deletionCalls.push('cancel');
      const gate = this.current;
      const result = this.deletionNext.cancel.shift() ?? { status: 'canceled' as const };
      if (result.status === 'canceled' && gate.state === 'deletion-scheduled') {
        this.deletionState = { status: 'none' };
        this.setGate({ state: 'active', accountId: gate.accountId, eligibility: '18+' });
      }
      return result;
    },
    deletePermanently: async () => {
      this.deletionCalls.push('delete-permanently');
      const result = this.deletionNext.deletePermanently.shift() ?? { status: 'deleted' as const };
      if (result.status === 'deleted') this.setGate({ state: 'deleted' });
      return result;
    },
    status: async () => {
      this.deletionCalls.push('status');
      if (this.current.state === 'deleted') return this.deletionProgress;
      return opensRestrictedPaths(this.current) ? this.deletionState : null;
    },
    dismiss: async () => {
      this.deletionCalls.push('dismiss');
      if (this.current.state === 'deleted') this.setGate({ state: 'no-account' });
    },
  };

  /** No account records in screen tests (spec 4's screens script their own). */
  readonly records: AccountRecords = {
    save: async () => undefined,
    delete: async () => undefined,
    revisionedItems: async () => [],
    resolve: async () => ({ status: 'offline' }),
    totals: async () => ({ account: [], local: [] }),
    detail: async () => ({ status: 'offline' }),
  };

  /** No privacy choices in screen tests (spec 7's controls script their own). */
  readonly privacy: AccountPrivacy = {
    read: async () => null,
    withdrawAnalytics: async () => ({ status: 'unavailable' }),
    limitAdData: async () => ({ status: 'unavailable' }),
    grantAnalytics: async () => ({ status: 'unavailable' }),
    allowAdData: async () => ({ status: 'unavailable' }),
  };

  async renew() {
    this.calls.push({ method: 'renew' });
  }

  async checkAge() {
    this.calls.push({ method: 'checkAge' });
    return this.resolving(this.next.check.shift() ?? { status: 'question' as const });
  }

  async answerAgeQuestion(range: AgeRange) {
    this.calls.push({ method: 'answerAgeQuestion', range });
    return this.resolving(this.next.age.shift() ?? (range === 'under-13' ? { status: 'ineligible' as const } : { status: 'eligible' as const }));
  }

  async refreshEligibility() {
    this.calls.push({ method: 'refreshEligibility' });
  }

  /** On a restricted account, an answer moves the gate as the real service does. */
  private resolving<T extends AgeCheckResult>(result: T): T {
    const gate = this.current;
    if (gate.state !== 'age-unresolved' && gate.state !== 'age-ineligible') return result;
    if (result.status === 'eligible') this.setGate({ state: 'active', accountId: gate.accountId, eligibility: '18+' });
    if (result.status === 'ineligible') this.setGate({ state: 'age-ineligible', accountId: gate.accountId });
    return result;
  }

  async requestEmailCode(request: { email: string; intent: CodeIntent }) {
    this.calls.push({ method: 'requestEmailCode', ...request });
    return this.next.code.shift() ?? { status: 'sent' as const };
  }

  async signInWithProvider(provider: IdentityProvider) {
    this.calls.push({ method: 'signInWithProvider', provider });
    const result = this.next.providerSignIn.shift() ?? { status: 'signed-in' as const };
    if (result.status === 'signed-in') this.setGate({ state: 'active', accountId: FAKE_ACCOUNT_ID, eligibility: '18+' });
    return result;
  }

  async createWithProvider(provider: IdentityProvider, options: { readonly sameIdentity?: boolean } = {}) {
    this.calls.push({ method: 'createWithProvider', provider, sameIdentity: options.sameIdentity ?? false });
    const result = this.next.providerCreate.shift() ?? { status: 'created' as const };
    if (result.status === 'created' || result.status === 'signed-in') this.setGate({ state: 'active', accountId: FAKE_ACCOUNT_ID, eligibility: '18+' });
    return result;
  }

  async signInAsReviewer(request: { email: string; credential: string }) {
    this.calls.push({ method: 'signInAsReviewer', ...request });
    const result = this.next.reviewer.shift() ?? { status: 'signed-in' as const };
    if (result.status === 'signed-in') this.setGate({ state: 'active', accountId: FAKE_ACCOUNT_ID, eligibility: '18+' });
    return result;
  }

  async verifyEmailCode(request: { email: string; code: string }) {
    this.calls.push({ method: 'verifyEmailCode', ...request });
    const result = this.next.verify.shift() ?? { status: 'signed-in' as const };
    if (result.status === 'signed-in') this.setGate({ state: 'active', accountId: FAKE_ACCOUNT_ID, eligibility: '18+' });
    return result;
  }
}

/** The app account over a fake service; offline game choices live in a map. */
export function fakeAppAccount(options: { readonly stored?: AccountGate; readonly offlineGame?: GameId | null } = {}) {
  const service = new FakeAccountService(options.stored);
  const offlineGames = new Map<string, GameId>();
  const opened: RestrictedPath[] = [];
  if (options.offlineGame && options.stored && 'accountId' in options.stored) offlineGames.set(options.stored.accountId, options.offlineGame);
  const shared: ExportFile[] = [];
  const account: AppAccount & {
    readonly service: FakeAccountService;
    readonly offlineGames: Map<string, GameId>;
    /** The restricted paths opened, in order. */
    readonly opened: RestrictedPath[];
    /** The export files handed to the share sheet, in order. */
    readonly shared: ExportFile[];
  } = {
    service,
    offlineGames,
    opened,
    shared,
    exportFiles: {
      share: async (_accountId, file) => {
        shared.push(file);
        return 'shared';
      },
      clear: async () => undefined,
    },
    restrictedPaths: { open: (path) => void opened.push(path) },
    // Practice keeps the adapters it was given: tests choose the store.
    practice: (base) => base,
    offlineGame: {
      get: async (accountId) => offlineGames.get(accountId) ?? null,
      set: async (accountId, game) => {
        offlineGames.set(accountId, game);
      },
    },
  };
  return account;
}

/** The gate of a signed-in account: what most app tests reopen into (with an offline game selected, in jest.setup.ts). */
export const SIGNED_IN: AccountGate = { state: 'active', accountId: FAKE_ACCOUNT_ID, eligibility: '18+' };
