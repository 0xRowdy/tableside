import type { AccountSummary } from '@tableside/account';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { useAccount } from './AccountProvider';

export interface AccountOverview {
  readonly summary: AccountSummary | null;
  readonly waiting: number;
}

export function useAccountOverview(): AccountOverview | undefined {
  const { service } = useAccount();
  const [overview, setOverview] = useState<AccountOverview>();
  useFocusEffect(
    useCallback(() => {
      let live = true;
      void Promise.all([service.accountSummary(), service.sync.countWaiting()]).then(([summary, waiting]) => live && setOverview({ summary, waiting }));
      return () => {
        live = false;
      };
    }, [service]),
  );
  return overview;
}
