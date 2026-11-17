// Spec 3 Modules › Training service; #158
import type { EntropySource } from '@tableside/engine';

import type { AccessSupervisor, Clock } from '../practice/adapters';
import type { TrainingStore } from './store';

export interface TrainingAdapters {
  readonly store: TrainingStore;
  readonly access: Pick<AccessSupervisor, 'beforeChallenge'>;
  readonly clock: Clock;
  readonly entropy: EntropySource;
  newId(): string;
  readonly device: string;
  readonly owner: string;
}
