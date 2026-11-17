// docs/account-service.md Credentials and the account vault
import { isRestricted, opensOrdinaryAccess, type AccountGate, type AccountService } from '@tableside/account';
import { createContext, useCallback, useContext, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AppState } from 'react-native';

import type { GameId } from '@/games';
import { useFollow } from '@/hooks/use-follow';
import { useLoaded } from '@/hooks/use-loaded';

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

function followAppForeground(service: AccountService, setReady: (ready: true) => void): () => void {
  const restore = () =>
    service.resume().then(
      () => setReady(true),
      () => undefined,
    );
  void restore();
  const subscription = AppState.addEventListener('change', (state) => {
    if (state !== 'active') return;
    if (service.gate.state === 'no-account') void restore();
    else void service.renew();
  });
  return () => subscription.remove();
}

function followRenewal(service: AccountService): () => void {
  let renewing = false;
  const renewWhenDue = () => {
    const { gate } = service;
    if (renewing || !(gate.state === 'renewal-pending' || isRestricted(gate))) return;
    renewing = true;
    void service.renew().finally(() => {
      renewing = false;
    });
  };
  renewWhenDue();
  return service.subscribe(renewWhenDue);
}

const loadOfflineGame = async (account: AppAccount, accountId: string | null) => (accountId ? account.offlineGame.get(accountId) : undefined);

export function AccountProvider({ children }: { children: ReactNode }) {
  const [account] = useState(createAppAccount);
  const { service } = account;
  const gate = useSyncExternalStore(service.subscribe, () => service.gate);
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<{ accountId: string; game: GameId } | null>(null);

  useFollow(followAppForeground, service, setReady);
  useFollow(followRenewal, service);

  const accountId = opensOrdinaryAccess(gate) ? gate.accountId : null;
  const stored = useLoaded(loadOfflineGame, account, accountId);

  const selectOfflineGame = useCallback(
    async (game: GameId) => {
      if (!accountId) return;
      await account.offlineGame.set(accountId, game);
      setSelected({ accountId, game });
    },
    [account, accountId],
  );

  if (!ready) return null;
  const value: AccountContextValue = {
    account,
    service,
    gate,
    offlineGame: accountId ? (selected?.accountId === accountId ? selected.game : stored) : undefined,
    selectOfflineGame,
  };
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountContextValue {
  const value = useContext(AccountContext);
  if (!value) throw new Error('useAccount needs an AccountProvider');
  return value;
}
