// S2-20 Sync status, opened from Settings → Account, over the Account service's sync.

import { router } from 'expo-router';

import { useAccount } from '@/account/AccountProvider';
import { SyncStatusScreen } from '@/account/SyncStatusScreen';

export default function SyncStatus() {
  const { service } = useAccount();
  return (
    <SyncStatusScreen
      sync={service.sync}
      onBack={() => router.dismissTo('/more/settings/account')}
      // The store link arrives with the store listings (spec 7).
      onUpdate={() => undefined}
    />
  );
}
