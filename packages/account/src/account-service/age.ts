// Age eligibility on the device (spec 2, *Age eligibility*): the Create
// path's age step and its eligibility assertion, retrying an unresolved
// account, and the refresh that applies what the platform says and reports it.

import {
  type EligibilityBand,
  type EligibilityRecord,
  type EligibilitySource,
  declarationPermitted,
  noPlatformAgeSignals,
  parseEligibilityRecord,
  requiredCheck,
} from '../eligibility';
import { instant } from '../values';

import type { ServiceContext } from './context';
import { UNAVAILABLE, afterSignal, isAgeRange, sameRecord } from './remembered';
import type { AccountSession, OpenSession } from './session';
import type { AccountService, AgeAnswerResult } from './types';

interface Assertion {
  readonly token: string;
  readonly expiresAt: number;
}

export type AgeEligibility = ReturnType<typeof createAgeEligibility>;

export function createAgeEligibility(ctx: ServiceContext, session: AccountSession) {
  const { options } = ctx;
  const ageSignals = options.ageSignals ?? noPlatformAgeSignals;
  let assertion: Assertion | null = null;
  /** The Create path's platform check found a required check in the way: the fallback answer can't decide. */
  let declarationBlocked = false;
  /** The eligibility refresh in flight, for the session it belongs to. */
  let refreshing: { readonly session: OpenSession; readonly run: Promise<void> } | null = null;
  /** Runs when the Create path ends without an account (under 13): nothing about the player is kept. */
  const forgotten = new Set<() => void>();
  const forgetPlayer = () => forgotten.forEach((forget) => forget());

  /**
   * The server's current record for the signed-in account and its deletion
   * deadline (undefined unless deletion is scheduled), or null when it can't
   * say (the gate denies, or the answer was lost).
   */
  const serverRecord = async (): Promise<{ readonly record: EligibilityRecord; readonly deletionDeadline: number | undefined } | null> => {
    try {
      const supabase = await ctx.connect();
      const { data, error } = await supabase.rpc('current_account');
      const record = error ? null : parseEligibilityRecord(data);
      return record ? { record, deletionDeadline: instant((data as { deletion_deadline?: unknown }).deletion_deadline) ?? undefined } : null;
    } catch {
      return null;
    }
  };

  /** Reports a decision; the server's answer becomes the account's record. False when it couldn't be sent. */
  const report = async (current: OpenSession, record: EligibilityRecord): Promise<boolean> => {
    try {
      const supabase = await ctx.connect();
      const { data, error } = await supabase.rpc('record_eligibility_v1', { band: record.status, source: record.source });
      const answer = error ? null : parseEligibilityRecord(data);
      if (!answer || session.opened !== current) return false;
      const accepted = (data as { accepted?: unknown }).accepted === true;
      const reported = accepted && record.source === 'platform-signal' && isAgeRange(record.status) ? record.status : current.remembered.reported;
      await session.rememberEligibility(current, { ...current.remembered, eligibility: answer, ...(reported ? { reported } : {}) });
      return true;
    } catch {
      return false;
    }
  };

  /**
   * Tells the server the required check this installation owes (or that it
   * owes none), when that changed: while one is owed, the server refuses a
   * declaration for the account, from any caller.
   */
  const reportCheck = async (current: OpenSession): Promise<void> => {
    const check = current.remembered.check ?? null;
    if (!current.registered || current.serverCheck === check) return;
    try {
      const { data, error } = await (await ctx.connect()).rpc('record_age_check_v1', { age_check: check });
      if (!error && (data as { status?: unknown } | null)?.status === 'recorded' && session.opened === current) current.serverCheck = check;
    } catch {
      // Offline: the next refresh tells it.
    }
  };

  /**
   * Sends what this device's platform says: the check it owes, then the range
   * it established, once (not while deletion is scheduled: that is no restricted path).
   */
  const reportSignal = async (current: OpenSession): Promise<void> => {
    await reportCheck(current);
    if (session.opened !== current) return;
    const { signal, reported, deletionDeadline } = current.remembered;
    if (signal && signal !== reported && deletionDeadline === undefined) await report(current, { status: signal, source: 'platform-signal' });
  };

  const refreshOnce = async (current: OpenSession) => {
    // What became of the session first: a revoked one locks, and nothing else runs for it.
    await session.checkLifecycle(current);
    if (session.opened !== current) return;
    const signal = await ageSignals.check({ interactive: false }).catch(() => UNAVAILABLE);
    if (session.opened !== current) return;
    // What the platform says applies at once, offline too: restrictions never wait for the server.
    await session.rememberEligibility(current, afterSignal(current.remembered, signal));
    if (!(await session.canAskServer(current, { renew: false }))) return;
    await session.registerDevice(current);
    await session.updateSync();
    await reportSignal(current);
    const answer = await serverRecord();
    if (!answer || session.opened !== current) return;
    await session.rememberDeletion(current, answer.deletionDeadline);
    if (session.opened !== current || sameRecord(answer.record, current.remembered.eligibility)) return;
    await session.rememberEligibility(current, { ...current.remembered, eligibility: answer.record });
  };

  const refreshEligibility = (): Promise<void> => {
    const current = session.opened;
    if (!current) return Promise.resolve();
    if (refreshing?.session === current) return refreshing.run;
    const run = refreshOnce(current).finally(() => {
      if (refreshing?.run === run) refreshing = null;
    });
    refreshing = { session: current, run };
    return run;
  };
  session.setRefresh(refreshEligibility);

  /** The Create path: a short-lived, single-use assertion for an established range, carrying the device locale's currency. */
  const obtainAssertion = async (range: EligibilityBand, source: EligibilitySource): Promise<AgeAnswerResult> => {
    try {
      const supabase = await ctx.connect();
      const { data, error } = await supabase.rpc('issue_eligibility_assertion', { age_range: range, currency: options.localeCurrency(), source });
      if (error) return { status: 'failed' };
      const issued = data as { assertion: string; expires_at: string };
      assertion = { token: issued.assertion, expiresAt: Date.parse(issued.expires_at) };
      return { status: 'eligible' };
    } catch {
      return { status: 'failed' };
    }
  };

  /** What an unresolved account's retry ended in. */
  const retryOutcome = (): AgeAnswerResult => {
    if (ctx.gate.state === 'age-ineligible') return { status: 'ineligible' };
    if (ctx.gate.state === 'age-unresolved') return { status: 'unresolved' };
    return { status: 'eligible' };
  };

  const api: Pick<AccountService, 'platformAgeCheck' | 'checkAge' | 'answerAgeQuestion' | 'refreshEligibility'> = {
    platformAgeCheck: ageSignals.supported,

    async checkAge() {
      if (ctx.gate.state === 'no-account') {
        assertion = null;
        declarationBlocked = false;
        const signal = await ageSignals.check({ interactive: true }).catch(() => UNAVAILABLE);
        if (requiredCheck(signal)) {
          declarationBlocked = true;
          return { status: 'unresolved' };
        }
        if (signal.kind !== 'range') return { status: 'question' };
        if (signal.range === 'under-13') {
          // Under 13 ends here: nothing is sent, and nothing is kept, not even who a provider said they were.
          forgetPlayer();
          return { status: 'ineligible' };
        }
        return obtainAssertion(signal.range, 'platform-signal');
      }
      const current = session.opened;
      if (ctx.gate.state !== 'age-unresolved' || !current) return { status: 'failed' };
      const signal = await ageSignals.check({ interactive: true }).catch(() => UNAVAILABLE);
      if (session.opened !== current) return { status: 'failed' };
      await session.rememberEligibility(current, afterSignal(current.remembered, signal));
      if (await session.canAskServer(current, { renew: true })) await reportSignal(current);
      // The platform proved nothing: the record stands, and the question may decide only if nothing sufficient is on it.
      if (ctx.gate.state === 'age-unresolved' && declarationPermitted(current.remembered.eligibility, current.remembered.check ?? null)) return { status: 'question' };
      return retryOutcome();
    },

    async answerAgeQuestion(range) {
      const current = session.opened;
      if (ctx.gate.state === 'age-unresolved' && current) {
        if (!declarationPermitted(current.remembered.eligibility, current.remembered.check ?? null)) return { status: 'unresolved' };
        if (!(await session.canAskServer(current, { renew: true })) || !(await report(current, { status: range, source: 'declaration' }))) return { status: 'failed' };
        return retryOutcome();
      }
      assertion = null;
      if (declarationBlocked) return { status: 'unresolved' };
      if (range === 'under-13') {
        // Nothing about an under-13 player is kept, not even who a provider said they were.
        forgetPlayer();
        return { status: 'ineligible' };
      }
      return obtainAssertion(range, 'declaration');
    },

    refreshEligibility,
  };

  return {
    api,
    ageSignals,
    reportSignal,
    /** The Create path's assertion, while it hasn't expired. */
    currentAssertion: () => (assertion && assertion.expiresAt > options.clock() ? assertion : null),
    /** The server refused the assertion (expired, or used): the age step runs again. */
    dropAssertion() {
      assertion = null;
    },
    /** A sign-in ends the Create path. */
    signedIn() {
      assertion = null;
      declarationBlocked = false;
    },
    /** Called when the Create path ends without an account: forget who a provider said the player was. */
    onPlayerForgotten: (forget: () => void) => void forgotten.add(forget),
  };
}
