// Spec 3 Modules › Training service; Amendment 1 B5; #158, #132, #135, #136
import type { AccountService } from '@tableside/account';
import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { useAccount } from '@/account/AccountProvider';
import { followAccountGate, withAccountGate } from '@/account/gate-access';
import { useFollow } from '@/hooks/use-follow';
import { useLoaded } from '@/hooks/use-loaded';
import { sampling } from '@/responsiveness/probe';

import { createTrainingAdapters } from './app-adapters';
import { TrainingService, type InstructionWithheld, type LearningPreferences, type LessonAccess, type LessonEntry } from './service';
import { followSpokenCards } from './speech';

const TrainingContext = createContext<TrainingService | null>(null);

// Spec 2 Amendment 1 B3; Spec 3 Amendment 1 B5
function followAccountSessionEnding(accounts: AccountService, training: TrainingService): () => void {
  return accounts.onAccountSessionEnding(() => training.lifecycle('signed-out'));
}

function followAppLifecycle(training: TrainingService): () => void {
  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'background') void training.lifecycle('backgrounded');
  });
  return () => subscription.remove();
}

export function TrainingProvider({ children }: { children: ReactNode }) {
  const { account } = useAccount();
  const { service: accounts } = account;
  const [{ service, speech }] = useState(() => {
    const adapters = account.training(createTrainingAdapters());
    // Spec 3 Launch gates 8; #156
    const store = sampling?.trainingStore(adapters.store) ?? adapters.store;
    return { service: new TrainingService({ ...adapters, store, access: withAccountGate(adapters.access, () => accounts.gate) }), speech: adapters.speech };
  });
  useLoaded((training) => training.load(), service);
  useFollow(followAccountSessionEnding, accounts, service);
  useFollow(followAccountGate, accounts, service);
  useFollow(followAppLifecycle, service);
  useFollow(followSpokenCards, service, speech);
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

// Spec 3 Lessons › Access, Check protection; Amendments 3 and 5; #149
const withheldOf = (service: TrainingService, _revision: number) => service.instructionWithheld().catch(() => null);
const lessonAccessOf = (service: TrainingService, lesson: string, _revision: number) => service.lessonAccess(lesson).catch(() => null);

export function useInstructionWithheld(): InstructionWithheld | null | undefined {
  const service = useTrainingService();
  return useLoaded(withheldOf, service, useSyncExternalStore(service.subscribe, service.accessRevision));
}

export function useLessonAccess(lesson: string): LessonAccess | null | undefined {
  const service = useTrainingService();
  return useLoaded(lessonAccessOf, service, lesson, useSyncExternalStore(service.subscribe, service.accessRevision));
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
