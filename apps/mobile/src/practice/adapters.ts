// The practice controller's substitute-able adapters: clock, secure entropy,
// identifiers and the access supervisor port.

import type { EntropySource, Phase } from '@tableside/engine';

import type { ActivityStore, MeteringBasis } from './store';

/** Wall-clock time for records, and waits that pace automatic steps. Never a seed. */
export interface Clock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

/**
 * What a denial asks the controller to do.
 * "stop": access ended; finish the started turn, stop new play, return removable wagers, settle.
 * "suspend": pause now in the committed phase; no reveal, no final settlement, no charge.
 * "suspend-at-turn-boundary": start no new turn; a turn in progress finishes, then suspend.
 */
export type Disposition = 'stop' | 'suspend' | 'suspend-at-turn-boundary';

export interface AccessDenial {
  readonly status: 'denied' | 'uncertain';
  readonly provenance: string;
  readonly disposition: Disposition;
  /** Player-facing reason, if the policy has one. */
  readonly reason?: string;
}

/** Allowed (with any extra the question carries), denied or uncertain, always with provenance. */
export type AccessDecision<Allowed extends object = object> =
  | ({ readonly status: 'allowed'; readonly provenance: string } & Allowed)
  | AccessDenial;

/** The admission answer carries how the activity is metered (spec 5). */
export type AdmissionDecision = AccessDecision<{ readonly meteringBasis: MeteringBasis }>;

/** Before a turn only: the allowance this turn uses, charged once with the turn's beginning. */
export type TurnDecision = AccessDecision<{ readonly turnCharge?: { readonly grant: string; readonly amount: string } }>;

export type LifecycleEvent = 'backgrounded' | 'foregrounded' | 'signed-out' | 'access-changed';

/** What the timed-metering hook hears whenever the session's metered state changes. */
export interface PhaseReport {
  readonly activityId: string;
  readonly phase: Phase;
  readonly suspended: boolean;
  /** True only while the time counts as active training (spec 5, Amendment 4 A4). */
  readonly timed: boolean;
}

/**
 * The access supervisor port. The real policy is spec 5's (with spec 2's gate
 * states); spec 1 ships the always-allowed stub below.
 */
export interface AccessSupervisor {
  /** Before a new activity is created. "uncertain" blocks the start. */
  beforeActivity(context: { readonly game: string }): Promise<AdmissionDecision>;
  /** Before each turn begins. */
  beforeTurn(context: { readonly activityId: string; readonly turn: number }): Promise<TurnDecision>;
  /** Before a suspended activity resumes. Any answer but "allowed" blocks the resume and changes nothing. */
  beforeResume(context: { readonly activityId: string; readonly phase: Phase }): Promise<AccessDecision>;
  /** On an app lifecycle or access event while an activity is unfinished. */
  onLifecycle(context: { readonly activityId: string; readonly event: LifecycleEvent }): Promise<AccessDecision>;
  /**
   * Before ending a suspended activity: whether the gate states leave ordinary
   * access open (spec 2). Answered locally; time and connectivity never block it.
   */
  beforeEndWhileSuspended(context: { readonly activityId: string }): Promise<{ readonly status: 'allowed' } | { readonly status: 'blocked'; readonly reason: string }>;
  /** The timed-metering hook: called on every change of the metered state. */
  phaseChanged(report: PhaseReport): void;
}

const STUB = 'spec-1-stub';

/** Spec 1's stub: every activity, turn and resume is allowed, unmetered beyond free play. */
export const alwaysAllowed: AccessSupervisor = {
  beforeActivity: async () => ({ status: 'allowed', provenance: STUB, meteringBasis: 'free-play' }),
  beforeTurn: async () => ({ status: 'allowed', provenance: STUB }),
  beforeResume: async () => ({ status: 'allowed', provenance: STUB }),
  onLifecycle: async () => ({ status: 'allowed', provenance: STUB }),
  beforeEndWhileSuspended: async () => ({ status: 'allowed' }),
  phaseChanged: () => undefined,
};

export interface PracticeAdapters {
  readonly store: ActivityStore;
  readonly access: AccessSupervisor;
  readonly clock: Clock;
  readonly entropy: EntropySource;
  /** A fresh unique id for a new activity. */
  newId(): string;
  /** Originating device and account owner, recorded on each activity. */
  readonly device: string;
  readonly owner: string;
}
