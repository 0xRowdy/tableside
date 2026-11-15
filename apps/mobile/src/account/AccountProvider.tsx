import type { AccountGate, AccountService } from '@tableside/account';
import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AppState } from 'react-native';

import type { GameId } from '@/games';

import { createAppAccount, type AppAccount } from './app-account';

/** Gate states that open ordinary access: Renewal pending keeps it while the token renews. */
export type SignedInGate = Extract<AccountGate, { state: 'active' | 'renewal-pending' }>;

export const isSignedIn = (gate: AccountGate): gate is SignedInGate => gate.state === 'active' || gate.state === 'renewal-pending';

interface AccountContextValue {
  readonly account: AppAccount;
  readonly service: AccountService;
  readonly gate: AccountGate;
  /** The signed-in account's offline game selection: undefined while it loads, null before the player makes it. */
  readonly offlineGame: GameId | null | undefined;
  selectOfflineGame(game: GameId): Promise<void>;
}

const AccountContext = createContext<AccountContextValue | null>(null);

/**
 * Owns the app's account. On launch it reopens the account this installation
 * last signed in to, with no network (spec 2: connectivity is needed only for
 * first sign-in), and renders nothing until it has looked. An expired token
 * renews when the app comes to the foreground.
 */
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
        // A locked keychain: the next foreground tries again.
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
    if (gate.state === 'renewal-pending') void service.renew();
  }, [gate.state, service]);

  const accountId = isSignedIn(gate) ? gate.accountId : null;
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
