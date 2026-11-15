// Account-service fakes for seam 3 screen tests: a scripted Account service
// with no network or storage, and the app account around it.

import type {
  AccountGate,
  AccountService,
  AccountSync,
  AgeAnswerResult,
  AgeCheckResult,
  AgeRange,
  CodeIntent,
  CodeRequestResult,
  CodeVerificationResult,
} from '@tableside/account';

import type { GameId } from '@/games';

import type { AppAccount } from '../app-account';
import type { RestrictedPath } from '../RestrictedPaths';

export const FAKE_ACCOUNT_ID = 'account-1';

type Call =
  | { readonly method: 'answerAgeQuestion'; readonly range: AgeRange }
  | { readonly method: 'requestEmailCode'; readonly email: string; readonly intent: CodeIntent }
  | { readonly method: 'verifyEmailCode'; readonly email: string; readonly code: string }
  | { readonly method: 'resume' | 'renew' | 'checkAge' | 'refreshEligibility' };

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
  } = { age: [], check: [], code: [], verify: [] };
  /** Whether the device offers a platform age check. */
  platformAgeCheck = false;

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
    return { status: 'resumed' as const };
  }

  /** No synchronization runs in screen tests. */
  readonly sync: AccountSync = {
    status: { live: false, error: null },
    reconcile: async () => undefined,
    idle: async () => undefined,
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
  const account: AppAccount & {
    readonly service: FakeAccountService;
    readonly offlineGames: Map<string, GameId>;
    /** The restricted paths opened, in order. */
    readonly opened: RestrictedPath[];
  } = {
    service,
    offlineGames,
    opened,
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
