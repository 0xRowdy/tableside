// Spec 3 Modules › Training service; #158
import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from 'react';

import { useAccount } from '@/account/AccountProvider';
import { withAccountGate } from '@/account/gate-access';
import { useLoaded } from '@/hooks/use-loaded';

import { createTrainingAdapters } from './app-adapters';
import { TrainingService, type LessonEntry } from './service';

const TrainingContext = createContext<TrainingService | null>(null);

export function TrainingProvider({ children }: { children: ReactNode }) {
  const { account } = useAccount();
  const { service: accounts } = account;
  const [service] = useState(() => {
    const adapters = account.training(createTrainingAdapters());
    return new TrainingService({ ...adapters, access: withAccountGate(adapters.access, () => accounts.gate) });
  });
  useLoaded((training) => training.load(), service);
  return <TrainingContext.Provider value={service}>{children}</TrainingContext.Provider>;
}

export function useTraining() {
  const service = useContext(TrainingContext);
  if (!service) throw new Error('useTraining needs a TrainingProvider');
  const snapshot = useSyncExternalStore(service.subscribe, service.snapshot);
  return { service, snapshot };
}

// #143
const listLessonsOf = (service: TrainingService, _revision: number) => service.listLessons();

export function useLessons(): { readonly service: TrainingService; readonly lessons: readonly LessonEntry[] | undefined } {
  const service = useContext(TrainingContext);
  if (!service) throw new Error('useLessons needs a TrainingProvider');
  const revision = useSyncExternalStore(service.subscribe, service.lessonRevision);
  return { service, lessons: useLoaded(listLessonsOf, service, revision) };
}
