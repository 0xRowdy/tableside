// Spec 2 S2-22

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
