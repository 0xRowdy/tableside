// Spec 2 S2-20

import { router } from 'expo-router';

import { useAccount } from '@/account/AccountProvider';
import { SyncStatusScreen } from '@/account/SyncStatusScreen';

export default function SyncStatus() {
  const { service } = useAccount();
  return (
    <SyncStatusScreen
      sync={service.sync}
      onBack={() => router.dismissTo('/more/settings/account')}
      // TODO(spec 7)
      onUpdate={() => undefined}
    />
  );
}
