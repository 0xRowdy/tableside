// S2-22 Delete account on the restricted paths: an account whose age isn't
// established reaches it from its paused screen, where the tab bar is hidden
// (spec 2 *Age eligibility*). Once deletion is scheduled, the locked screen
// (S2-23) takes over.

import { Redirect, router } from 'expo-router';

import { useAccount } from '@/account/AccountProvider';
import { DeleteAccountScreen } from '@/account/DeleteAccountScreen';
import { opensRestrictedPaths } from '@tableside/account';

export default function RestrictedDelete() {
  const { gate } = useAccount();
  if (!opensRestrictedPaths(gate) || gate.state === 'deletion-scheduled') return <Redirect href="/" />;
  return (
    <DeleteAccountScreen
      back={{ label: 'Back', onPress: () => (router.canGoBack() ? router.back() : router.replace('/')) }}
      onExport={() => router.navigate('/export')}
    />
  );
}
