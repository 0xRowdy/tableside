import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from 'react';

import { useFollow } from '@/hooks/use-follow';
import { useLoaded } from '@/hooks/use-loaded';
import { usePractice } from '@/practice/PracticeProvider';
import { useTrainingService } from '@/training/TrainingProvider';

import { createDevicePorts } from './device-ports';
import { followPractice } from './practice-cues';
import { FeedbackService } from './service';
import { DeviceSettings } from './settings';
import { followTraining } from './training-cues';

const FeedbackContext = createContext<FeedbackService | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const { controller } = usePractice();
  const training = useTrainingService();
  const [service] = useState(() => {
    const ports = createDevicePorts();
    return new FeedbackService(ports, new DeviceSettings(ports.storage));
  });
  useLoaded((feedback) => feedback.settings.load(), service);
  useFollow(followPractice, controller, service);
  useFollow(followTraining, training, service);
  return <FeedbackContext.Provider value={service}>{children}</FeedbackContext.Provider>;
}

export function useFeedback(): FeedbackService {
  const service = useContext(FeedbackContext);
  if (!service) throw new Error('useFeedback needs a FeedbackProvider');
  return service;
}

export function useFeedbackSettings() {
  const { settings } = useFeedback();
  const current = useSyncExternalStore(settings.subscribe, settings.snapshot);
  return { settings, current };
}
