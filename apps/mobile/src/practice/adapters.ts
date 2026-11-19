import type { ChallengePhase, EntropySource, GameId, Phase, QuarantineList, VersionedIdentity } from '@tableside/engine';

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

// Spec 1 Amendment 4 D; S5-11 xIl3L (figure)
export interface SetupTerms {
  readonly funding: SetupFunding;
  readonly allowance: { readonly title: string; readonly text: string; readonly figure?: { readonly label: string; readonly value: string } } | null;
  readonly seePremium: boolean;
}

export const PRACTICE_FUNDING_TERMS: SetupTerms = { funding: { source: 'practice-funding' }, allowance: null, seePremium: false };

// Spec 3 Amendment 4 §5
export type GameAccess = { readonly status: 'playable' } | { readonly status: 'needs-connection'; readonly offlineGame: GameId | null };

// Spec 1 Access boundary
export interface AccessSupervisor {
  beforeActivity(context: { readonly game: string }): Promise<AdmissionDecision>;
  // Spec 3 Training service interface › Start attempt; #158
  beforeChallenge(context: { readonly category: string; readonly variant: string }): Promise<AdmissionDecision>;
  beforeTurn(context: { readonly activityId: string; readonly turn: number; readonly strategy: VersionedIdentity | null }): Promise<TurnDecision>;
  // Spec 3 Training service interface › Resume; #135
  beforeResume(context: { readonly activityId: string; readonly phase: Phase | ChallengePhase }): Promise<AccessDecision>;
  onLifecycle(context: { readonly activityId: string; readonly event: LifecycleEvent }): Promise<AccessDecision>;
  // Spec 1 Amendment 4 A2
  beforeEndWhileSuspended(context: { readonly activityId: string }): Promise<{ readonly status: 'allowed' } | { readonly status: 'blocked'; readonly reason: string }>;
  phaseChanged(report: PhaseReport): void;
  setupTerms?(context: { readonly game: string }): Promise<SetupTerms>;
  // Spec 3 Lessons › Access; #149
  gameAccess(context: { readonly game: GameId }): Promise<GameAccess>;
}

const STUB = 'spec-1-stub';

export const alwaysAllowed: AccessSupervisor = {
  beforeActivity: async () => ({ status: 'allowed', provenance: STUB, meteringBasis: 'free-play' }),
  beforeChallenge: async () => ({ status: 'allowed', provenance: STUB, meteringBasis: 'challenge-attempt' }),
  beforeTurn: async () => ({ status: 'allowed', provenance: STUB }),
  beforeResume: async () => ({ status: 'allowed', provenance: STUB }),
  onLifecycle: async () => ({ status: 'allowed', provenance: STUB }),
  beforeEndWhileSuspended: async () => ({ status: 'allowed' }),
  phaseChanged: () => undefined,
  gameAccess: async () => ({ status: 'playable' }),
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
