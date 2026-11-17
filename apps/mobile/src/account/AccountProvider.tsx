import { isRestricted, opensOrdinaryAccess, type AccountGate, type AccountService } from '@tableside/account';
import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AppState } from 'react-native';

import type { GameId } from '@/games';

import { createAppAccount, type AppAccount } from './app-account';

export { isAgeRestricted, isRestricted, opensOrdinaryAccess, type SignedInGate } from '@tableside/account';

export type AgeRestrictedGate = Extract<AccountGate, { state: 'age-unresolved' | 'age-ineligible' }>;

interface AccountContextValue {
  readonly account: AppAccount;
  readonly service: AccountService;
  readonly gate: AccountGate;
  readonly offlineGame: GameId | null | undefined;
  selectOfflineGame(game: GameId): Promise<void>;
}

const AccountContext = createContext<AccountContextValue | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const [account] = useState(createAppAccount);
  const { service } = account;
  const gate = useSyncExternalStore(service.subscribe, () => service.gate);
  const [ready, setReady] = useState(false);
  const [offlineGame, setOfflineGame] = useState<{ accountId: string; game: GameId | null } | null>(null);

  useEffect(() => {
    let live = true;
    const restore = () =>
      service.resume().then(
        () => live && setReady(true),
        () => undefined,
      );
    void restore();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      if (service.gate.state === 'no-account') void restore();
      else void service.renew();
    });
    return () => {
      live = false;
      subscription.remove();
    };
  }, [service]);

  useEffect(() => {
    if (gate.state === 'renewal-pending' || isRestricted(gate)) void service.renew();
  }, [gate, service]);

  const accountId = opensOrdinaryAccess(gate) ? gate.accountId : null;
  useEffect(() => {
    if (!accountId) return;
    let live = true;
    void account.offlineGame.get(accountId).then((game) => live && setOfflineGame({ accountId, game }));
    return () => {
      live = false;
    };
  }, [account, accountId]);

  const selectOfflineGame = useCallback(
    async (game: GameId) => {
      if (!accountId) return;
      await account.offlineGame.set(accountId, game);
      setOfflineGame({ accountId, game });
    },
    [account, accountId],
  );

  if (!ready) return null;
  const value: AccountContextValue = {
    account,
    service,
    gate,
    offlineGame: accountId && offlineGame?.accountId === accountId ? offlineGame.game : undefined,
    selectOfflineGame,
  };
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountContextValue {
  const value = useContext(AccountContext);
  if (!value) throw new Error('useAccount needs an AccountProvider');
  return value;
}
