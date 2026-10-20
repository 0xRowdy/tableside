// The practice controller's substitute-able adapters: clock, secure entropy,
// identifiers and the access supervisor port.

import type { EntropySource } from '@tableside/engine';

import type { ActivityStore } from './store';

/** Wall-clock time for records, and waits that pace automatic steps. Never a seed. */
export interface Clock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

export type AccessDecision =
  | {
      readonly status: 'allowed';
      readonly provenance: string;
      /** Before a turn only: the allowance this turn uses, charged once with the turn's beginning. */
      readonly turnCharge?: { readonly grant: string; readonly amount: string };
    }
  | { readonly status: 'denied' | 'uncertain'; readonly provenance: string; readonly disposition: 'stop' | 'suspend' | 'suspend-at-turn-boundary' };

/** Asked before a new activity and before each turn. The real policy is spec 5's. */
export interface AccessSupervisor {
  beforeActivity(context: { readonly game: string }): Promise<AccessDecision>;
  beforeTurn(context: { readonly activityId: string; readonly turn: number }): Promise<AccessDecision>;
}

/** Spec 1's stub: every activity and turn is allowed. */
export const alwaysAllowed: AccessSupervisor = {
  beforeActivity: async () => ({ status: 'allowed', provenance: 'spec-1-stub' }),
  beforeTurn: async () => ({ status: 'allowed', provenance: 'spec-1-stub' }),
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
