// Spec 3 Modules › Training service; #158
import type { ChallengeAttemptRecord, EntropySource, QuarantineList } from '@tableside/engine';

import type { AccessSupervisor, Clock } from '../practice/adapters';
import type { ChallengeAllowanceState } from './allowance';
import type { TrainingStore } from './store';

export interface TrainingAdapters {
  readonly store: TrainingStore;
  readonly access: AccessSupervisor;
  // #150
  readonly allowance: ChallengeAllowanceState;
  readonly clock: Clock;
  readonly entropy: EntropySource;
  newId(): string;
  readonly device: string;
  readonly owner: string;
  // Spec 3 Attempt lifecycle (unusable); #135
  readonly quarantine: QuarantineList;
  // Spec 3 Amendment 1 C8; #142
  readonly attemptDetail?: (attemptId: string) => Promise<ChallengeAttemptRecord | null>;
}
