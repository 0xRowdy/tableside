import type { AccountService } from '@tableside/account';
import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { useAccount } from '@/account/AccountProvider';
import { followAccountGate, withAccountGate } from '@/account/gate-access';
import { useFollow } from '@/hooks/use-follow';
import { useLoaded } from '@/hooks/use-loaded';

import { createAppAdapters } from './app-adapters';
import { PracticeController } from './controller';

const PracticeContext = createContext<PracticeController | null>(null);

function followAccountSessionEnding(service: AccountService, controller: PracticeController): () => void {
  return service.onAccountSessionEnding(() => controller.accountSessionEnding());
}

function followAppLifecycle(controller: PracticeController): () => void {
  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'background') void controller.lifecycle('backgrounded');
    if (state === 'active') void controller.lifecycle('foregrounded');
  });
  return () => subscription.remove();
}

// Spec 2 Amendment 1 B3
export function PracticeProvider({ children }: { children: ReactNode }) {
  const { account } = useAccount();
  const { service } = account;
  const [controller] = useState(() => {
    const adapters = account.practice(createAppAdapters());
    return new PracticeController({ ...adapters, access: withAccountGate(adapters.access, () => service.gate) });
  });
  useLoaded((practice) => practice.load(), controller);
  useFollow(followAccountSessionEnding, service, controller);
  useFollow(followAccountGate, service, controller);
  useFollow(followAppLifecycle, controller);
  return <PracticeContext.Provider value={controller}>{children}</PracticeContext.Provider>;
}

export function usePractice() {
  const controller = useContext(PracticeContext);
  if (!controller) throw new Error('usePractice needs a PracticeProvider');
  const snapshot = useSyncExternalStore(controller.subscribe, controller.snapshot);
  return { controller, snapshot };
}
