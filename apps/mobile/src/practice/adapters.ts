// The practice controller's substitute-able adapters: clock, secure entropy,
// identifiers and the access supervisor port.

import type { EntropySource, Phase, QuarantineList, VersionedIdentity } from '@tableside/engine';

import type { ActivityStore, CompletedPracticeSession, MeteringBasis } from './store';

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
  /**
   * For a "stop": why play ends, as the record keeps it. Access or allowance
   * ending when omitted; "content-removed" for a required removal (Amendment 6 §5).
   */
  readonly stopCause?: 'access-ended' | 'content-removed';
}

/** Allowed (with any extra the question carries), denied or uncertain, always with provenance. */
export type AccessDecision<Allowed extends object = object> =
  | ({ readonly status: 'allowed'; readonly provenance: string } & Allowed)
  | AccessDenial;

/** The admission answer carries how the activity is metered (spec 5). */
export type AdmissionDecision = AccessDecision<{ readonly meteringBasis: MeteringBasis; readonly allowancePolicyVersion?: string }>;

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
 * How a new session of a game is funded under the account's policy (spec 5):
 * practice funding (a fresh buy-in, with rebuys), or the whole available
 * training bankroll (no buy-in field, no rebuys; Amendment 4 §B).
 */
export type SetupFunding =
  | { readonly source: 'practice-funding' }
  | { readonly source: 'training-bankroll'; /** Whole units, canonical: the bankroll the session would be allocated. */ readonly available: string };

/** What setup shows for a game before anything starts (Amendment 4 §D). Asking never charges. */
export interface SetupTerms {
  readonly funding: SetupFunding;
  /** The allowance line for the active method (time, turns or bankroll), or the premium line; null when there is none. */
  readonly allowance: { readonly title: string; readonly text: string } | null;
  /** Whether setup may link to See premium. Nothing promotes premium during play. */
  readonly seePremium: boolean;
}

/** Setup's terms when the policy has nothing to add: practice funding, no allowance line. */
export const PRACTICE_FUNDING_TERMS: SetupTerms = { funding: { source: 'practice-funding' }, allowance: null, seePremium: false };

/**
 * The access supervisor port. The real policy is spec 5's (with spec 2's gate
 * states); spec 1 ships the always-allowed stub below.
 */
export interface AccessSupervisor {
  /** Before a new activity is created. "uncertain" blocks the start. */
  beforeActivity(context: { readonly game: string }): Promise<AdmissionDecision>;
  /** Before each turn begins. `strategy` is the revision a guided activity pins; null in free play. */
  beforeTurn(context: { readonly activityId: string; readonly turn: number; readonly strategy: VersionedIdentity | null }): Promise<TurnDecision>;
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
  /** Setup's funding source and allowance line for a game (spec 5). Without it, setup offers practice funding. */
  setupTerms?(context: { readonly game: string }): Promise<SetupTerms>;
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

/** Strategy revisions a validated legal or privacy request requires removed (spec 6 keeps the list current). */
export interface RequiredRemovals {
  removed(strategy: VersionedIdentity): boolean;
}

const REQUIRED_REMOVAL: AccessDenial = {
  status: 'denied',
  provenance: 'required-removal',
  disposition: 'stop',
  stopCause: 'content-removed',
  reason: 'Removed after a validated legal or privacy request',
};

/**
 * A supervisor that answers `stop` before the next turn of an activity whose
 * pinned strategy revision a required removal covers (Amendment 6 §5): the
 * practice session takes the stop path at that turn boundary, and nothing more is
 * asked or charged. Everything else goes to the supervisor it wraps.
 */
export function withRequiredRemovals(access: AccessSupervisor, removals: RequiredRemovals): AccessSupervisor {
  return {
    ...access,
    beforeTurn: async (context) => (context.strategy && removals.removed(context.strategy) ? REQUIRED_REMOVAL : access.beforeTurn(context)),
  };
}

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
  /** The quarantine list shipped with the app (#80); an unfinished activity it names is marked incomplete. */
  readonly quarantine: QuarantineList;
  /**
   * The post-result hook (spec 5's ads, Amendment 4 §D): called when the player
   * leaves a result this process just produced, whose record is durably saved.
   * Never called for a session reopened from Saved.
   */
  readonly leftFreshResult?: (record: CompletedPracticeSession) => void;
}
