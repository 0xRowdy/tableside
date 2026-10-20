import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';

import { createAppAdapters } from './app-adapters';
import { PracticeController } from './controller';

const PracticeContext = createContext<PracticeController | null>(null);

/** Owns the app's one practice controller and resumes any unfinished session on launch. */
export function PracticeProvider({ children }: { children: ReactNode }) {
  const [controller] = useState(() => new PracticeController(createAppAdapters()));
  useEffect(() => {
    void controller.load();
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
