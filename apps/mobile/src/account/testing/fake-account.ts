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
  | { readonly method: 'resume' | 'renew' | 'signOut' | 'recover' | 'checkAge' | 'refreshEligibility' | 'downloadAllHistory' };

export const FAKE_SUMMARY: AccountSummary = {
  email: 'player@example.com',
  methods: ['apple', 'email'],
  currency: 'USD',
  currencyChangeable: true,
  devices: 3,
};

export const FAKE_METHODS: readonly SignInMethodEntry[] = [
  { id: 'method-apple', method: 'apple', email: 'x7k2@privaterelay.appleid.com' },
  { id: 'method-email', method: 'email', email: 'player@example.com' },
];

const DAY = 86_400_000;

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

export function fakeDevices(now = Date.now()): readonly DeviceEntry[] {
  return [
    { id: 'device-iphone', platform: 'ios', label: 'iPhone 15 · iOS 18', lastActiveAt: now, thisDevice: true },
    { id: 'device-ipad', platform: 'ios', label: 'iPad Air · iPadOS 18', lastActiveAt: now - 2 * DAY - 3_600_000, thisDevice: false },
    { id: 'device-pixel', platform: 'android', label: 'Pixel 8 · Android 15', lastActiveAt: now - 95 * DAY, thisDevice: false },
  ];
}

export class FakeAccountService implements AccountService {
  private current: AccountGate = { state: 'no-account' };
  private readonly listeners = new Set<(gate: AccountGate) => void>();
  readonly calls: Call[] = [];
  readonly next: {
    age: AgeAnswerResult[];
    check: AgeCheckResult[];
    code: CodeRequestResult[];
    verify: CodeVerificationResult[];
    signOut: SignOutResult[];
    currency: CurrencyChangeResult[];
    providerSignIn: ProviderSignInResult[];
    providerCreate: ProviderCreateResult[];
    reviewer: ReviewerSignInResult[];
  } = { age: [], check: [], code: [], verify: [], signOut: [], currency: [], providerSignIn: [], providerCreate: [], reviewer: [] };
  platformAgeCheck = false;
  summary: AccountSummary | null = FAKE_SUMMARY;
  waitingCount = 0;
  private readonly ending = new Set<() => Promise<void>>();

  constructor(
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

  async signOut(): Promise<SignOutResult> {
    this.calls.push({ method: 'signOut' });
    const gate = this.current;
    const unopened = gate.state === 'recovery-needed' || gate.state === 'database-unavailable';
    if (!opensOrdinaryAccess(gate) && !isRestricted(gate) && !unopened) return { status: 'not-signed-in' as const };
    for (const handler of [...this.ending]) await handler();
    this.setGate({ state: 'signed-out', accountId: gate.accountId });
    return this.next.signOut.shift() ?? { status: 'signed-out' as const, serverSessionEnded: true };
  }

  async recover(): Promise<{ readonly status: 'sign-in-needed' | 'failed' }> {
    this.calls.push({ method: 'recover' });
    const gate = this.current;
    if (gate.state !== 'recovery-needed') return { status: 'failed' };
    this.setGate({ state: 'signed-out', accountId: gate.accountId });
    return { status: 'sign-in-needed' };
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

  methods: readonly SignInMethodEntry[] | null = FAKE_METHODS;
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

  deviceEntries: readonly DeviceEntry[] | null = fakeDevices();
  readonly devicesNext: { signOut: DeviceSignOutResult[] } = { signOut: [] };
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

  serverExportState: ServerExport | null = { state: 'none' };
  readonly exportNext: { request: ServerExportRequest[]; download: ServerExportDownload[] } = { request: [], download: [] };
  supplement: LocalSupplement | null = FAKE_SUPPLEMENT;
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

  deletionState: DeletionStatus | null = { status: 'none' };
  readonly deletionNext: { schedule: ScheduleDeletionResult[]; cancel: CancelDeletionResult[]; deletePermanently: DeletePermanentlyResult[] } = {
    schedule: [],
    cancel: [],
    deletePermanently: [],
  };
  deletionProgress: DeletionProgress | null = null;
  readonly deletionCalls: string[] = [];

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

  readonly records: AccountRecords = {
    save: async () => undefined,
    delete: async () => undefined,
    revisionedItems: async () => [],
    resolve: async () => ({ status: 'offline' }),
    totals: async () => ({ account: [], local: [] }),
    detail: async () => ({ status: 'offline' }),
  };

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

export function fakeAppAccount(options: { readonly stored?: AccountGate; readonly offlineGame?: GameId | null } = {}) {
  const service = new FakeAccountService(options.stored);
  const offlineGames = new Map<string, GameId>();
  const opened: RestrictedPath[] = [];
  if (options.offlineGame && options.stored && 'accountId' in options.stored) offlineGames.set(options.stored.accountId, options.offlineGame);
  const shared: ExportFile[] = [];
  const account: AppAccount & {
    readonly service: FakeAccountService;
    readonly offlineGames: Map<string, GameId>;
    readonly opened: RestrictedPath[];
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
    practice: (base) => base,
    training: (base) => base,
    offlineGame: {
      get: async (accountId) => offlineGames.get(accountId) ?? null,
      set: async (accountId, game) => {
        offlineGames.set(accountId, game);
      },
    },
  };
  return account;
}

export const SIGNED_IN: AccountGate = { state: 'active', accountId: FAKE_ACCOUNT_ID, eligibility: '18+' };
