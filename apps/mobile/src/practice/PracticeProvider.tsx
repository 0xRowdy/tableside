import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { useAccount } from '@/account/AccountProvider';
import { followAccountGate, withAccountGate } from '@/account/gate-access';

import { createAppAdapters } from './app-adapters';
import { PracticeController } from './controller';

const PracticeContext = createContext<PracticeController | null>(null);

// Spec 2 Amendment 1 B3
export function PracticeProvider({ children }: { children: ReactNode }) {
  const { account } = useAccount();
  const { service } = account;
  const [controller] = useState(() => {
    const adapters = account.practice(createAppAdapters());
    return new PracticeController({ ...adapters, access: withAccountGate(adapters.access, () => service.gate) });
  });
  useEffect(() => {
    void controller.load();
  }, [controller]);
  useEffect(() => account.service.onAccountSessionEnding(() => controller.accountSessionEnding()), [account, controller]);
  useEffect(() => followAccountGate(service, controller), [service, controller]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') void controller.lifecycle('backgrounded');
      if (state === 'active') void controller.lifecycle('foregrounded');
    });
    return () => subscription.remove();
  }, [controller]);
  return <PracticeContext.Provider value={controller}>{children}</PracticeContext.Provider>;
}

export function usePractice() {
  const controller = useContext(PracticeContext);
  if (!controller) throw new Error('usePractice needs a PracticeProvider');
  const snapshot = useSyncExternalStore(controller.subscribe, controller.snapshot);
  return { controller, snapshot };
}
