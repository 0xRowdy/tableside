import type { EntropySource, Phase, QuarantineList, VersionedIdentity } from '@tableside/engine';

import type { ActivityStore, CompletedPracticeSession, MeteringBasis } from './store';

export interface Clock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

// Spec 1 Access boundary
export type Disposition = 'stop' | 'suspend' | 'suspend-at-turn-boundary';

export interface AccessDenial {
  readonly status: 'denied' | 'uncertain';
  readonly provenance: string;
  readonly disposition: Disposition;
  readonly reason?: string;
  // Spec 1 Amendment 6 §5
  readonly stopCause?: 'access-ended' | 'content-removed';
}

export type AccessDecision<Allowed extends object = object> =
  | ({ readonly status: 'allowed'; readonly provenance: string } & Allowed)
  | AccessDenial;

// Spec 1 Amendment 4 A3
export type AdmissionDecision = AccessDecision<{ readonly meteringBasis: MeteringBasis; readonly allowancePolicyVersion?: string; readonly timeGrant?: string }>;

export type TurnDecision = AccessDecision<{ readonly turnCharge?: { readonly grant: string; readonly amount: string } }>;

export type LifecycleEvent = 'backgrounded' | 'foregrounded' | 'signed-out' | 'access-changed';

// Spec 1 Amendment 4 A4
export interface PhaseReport {
  readonly activityId: string;
  readonly phase: Phase;
  readonly suspended: boolean;
  readonly timed: boolean;
}

// Spec 1 Amendment 4 B
export type SetupFunding =
  | { readonly source: 'practice-funding' }
  | { readonly source: 'training-bankroll'; readonly available: string };

// Spec 1 Amendment 4 D
export interface SetupTerms {
  readonly funding: SetupFunding;
  readonly allowance: { readonly title: string; readonly text: string } | null;
  readonly seePremium: boolean;
}

export const PRACTICE_FUNDING_TERMS: SetupTerms = { funding: { source: 'practice-funding' }, allowance: null, seePremium: false };

// Spec 1 Access boundary
export interface AccessSupervisor {
  beforeActivity(context: { readonly game: string }): Promise<AdmissionDecision>;
  beforeTurn(context: { readonly activityId: string; readonly turn: number; readonly strategy: VersionedIdentity | null }): Promise<TurnDecision>;
  beforeResume(context: { readonly activityId: string; readonly phase: Phase }): Promise<AccessDecision>;
  onLifecycle(context: { readonly activityId: string; readonly event: LifecycleEvent }): Promise<AccessDecision>;
  // Spec 1 Amendment 4 A2
  beforeEndWhileSuspended(context: { readonly activityId: string }): Promise<{ readonly status: 'allowed' } | { readonly status: 'blocked'; readonly reason: string }>;
  phaseChanged(report: PhaseReport): void;
  setupTerms?(context: { readonly game: string }): Promise<SetupTerms>;
}

const STUB = 'spec-1-stub';

export const alwaysAllowed: AccessSupervisor = {
  beforeActivity: async () => ({ status: 'allowed', provenance: STUB, meteringBasis: 'free-play' }),
  beforeTurn: async () => ({ status: 'allowed', provenance: STUB }),
  beforeResume: async () => ({ status: 'allowed', provenance: STUB }),
  onLifecycle: async () => ({ status: 'allowed', provenance: STUB }),
  beforeEndWhileSuspended: async () => ({ status: 'allowed' }),
  phaseChanged: () => undefined,
};

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

// Spec 1 Amendment 6 §5
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
  newId(): string;
  readonly device: string;
  readonly owner: string;
  readonly quarantine: QuarantineList;
  // Spec 1 Amendment 4 D
  readonly leftFreshResult?: (record: CompletedPracticeSession) => void;
}
