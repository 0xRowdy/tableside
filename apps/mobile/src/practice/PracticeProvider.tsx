import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { createAppAdapters } from './app-adapters';
import { PracticeController } from './controller';

const PracticeContext = createContext<PracticeController | null>(null);

/**
 * Owns the app's one practice controller. On launch it finds any unfinished
 * session, which waits suspended for the player; app lifecycle changes reach
 * the controller (backgrounding suspends, and the supervisor hears each one).
 */
export function PracticeProvider({ children }: { children: ReactNode }) {
  const [controller] = useState(() => new PracticeController(createAppAdapters()));
  useEffect(() => {
    void controller.load();
  }, [controller]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') void controller.lifecycle('backgrounded');
      if (state === 'active') void controller.lifecycle('foregrounded');
    });
    return () => subscription.remove();
  }, [controller]);
  return <PracticeContext.Provider value={controller}>{children}</PracticeContext.Provider>;
}

/** The controller and its latest published snapshot. */
export function usePractice() {
  const controller = useContext(PracticeContext);
  if (!controller) throw new Error('usePractice needs a PracticeProvider');
  const snapshot = useSyncExternalStore(controller.subscribe, controller.snapshot);
  return { controller, snapshot };
}
