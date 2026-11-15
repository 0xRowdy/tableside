import type { AccountSummary } from '@tableside/account';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { useAccount } from './AccountProvider';

export interface AccountOverview {
  /** Null when no account is signed in. */
  readonly summary: AccountSummary | null;
  /** Saved records that haven't synced. */
  readonly waiting: number;
}

/** What Settings → Account shows, read again each time the screen comes into view; undefined until it has loaded. */
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
