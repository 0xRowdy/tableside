import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';

import { usePractice } from '@/practice/PracticeProvider';

import { createDevicePorts } from './device-ports';
import { followPractice } from './practice-cues';
import { FeedbackService } from './service';
import { DeviceSettings } from './settings';

const FeedbackContext = createContext<FeedbackService | null>(null);

/** Owns the app's audio/haptics service, loads the device's preferences and follows practice play. */
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const { controller } = usePractice();
  const [service] = useState(() => {
    const ports = createDevicePorts();
    return new FeedbackService(ports, new DeviceSettings(ports.storage));
  });
  useEffect(() => {
    void service.settings.load();
  }, [service]);
  useEffect(() => followPractice(controller, service), [controller, service]);
  return <FeedbackContext.Provider value={service}>{children}</FeedbackContext.Provider>;
}

/** The audio/haptics service, for cues a screen raises itself (such as a draft it rejects). */
export function useFeedback(): FeedbackService {
  const service = useContext(FeedbackContext);
  if (!service) throw new Error('useFeedback needs a FeedbackProvider');
  return service;
}

/** The Sound & haptics preferences and their latest values. */
export function useFeedbackSettings() {
  const { settings } = useFeedback();
  const current = useSyncExternalStore(settings.subscribe, settings.snapshot);
  return { settings, current };
}
