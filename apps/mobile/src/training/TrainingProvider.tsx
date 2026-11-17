// Spec 3 Modules › Training service; #158, #132
import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from 'react';

import { useAccount } from '@/account/AccountProvider';
import { withAccountGate } from '@/account/gate-access';
import { useLoaded } from '@/hooks/use-loaded';

import { createTrainingAdapters } from './app-adapters';
import { TrainingService, type LearningPreferences, type LessonEntry } from './service';

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

export function useTrainingService(): TrainingService {
  const service = useContext(TrainingContext);
  if (!service) throw new Error('useTrainingService needs a TrainingProvider');
  return service;
}

export function useTraining() {
  const service = useTrainingService();
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

// Spec 3 Lessons › Entry points, Amendment 1 C7; #146
const learningOf = (service: TrainingService, _revision: number) => service.learningPreferences();

export function useLearningOf(service: TrainingService): LearningPreferences | undefined {
  const revision = useSyncExternalStore(service.subscribe, service.learningRevision);
  return useLoaded(learningOf, service, revision);
}

export function useLearning(): { readonly service: TrainingService; readonly learning: LearningPreferences | undefined } {
  const service = useTrainingService();
  return { service, learning: useLearningOf(service) };
}
