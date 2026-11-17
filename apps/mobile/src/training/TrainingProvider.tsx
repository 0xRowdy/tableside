// Spec 3 Modules › Training service; #158, #132
import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from 'react';

import { useAccount } from '@/account/AccountProvider';
import { withAccountGate } from '@/account/gate-access';
import { useLoaded } from '@/hooks/use-loaded';

import { createTrainingAdapters } from './app-adapters';
import { TrainingService } from './service';

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
  if (!service) throw new Error('useTraining needs a TrainingProvider');
  return service;
}

export function useTraining() {
  const service = useTrainingService();
  const snapshot = useSyncExternalStore(service.subscribe, service.snapshot);
  return { service, snapshot };
}
