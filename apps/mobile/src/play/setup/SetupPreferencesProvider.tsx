import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';

import { createSetupStorage } from './device-storage';
import { SetupPreferences } from './preferences';

const SetupPreferencesContext = createContext<SetupPreferences | null>(null);

export function SetupPreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences] = useState(() => new SetupPreferences(createSetupStorage()));
  useEffect(() => {
    void preferences.load();
  }, [preferences]);
  return <SetupPreferencesContext.Provider value={preferences}>{children}</SetupPreferencesContext.Provider>;
}

export function useSetupPreferences() {
  const preferences = useContext(SetupPreferencesContext);
  if (!preferences) throw new Error('useSetupPreferences needs a SetupPreferencesProvider');
  const buyIns = useSyncExternalStore(preferences.subscribe, preferences.snapshot);
  return { preferences, buyIns };
}
