// Spec 2 S2-21

import { Redirect, router } from 'expo-router';

import { useAccount } from '@/account/AccountProvider';
import { ExportScreen } from '@/account/ExportScreen';
import { opensRestrictedPaths } from '@tableside/account';

export default function RestrictedExport() {
  const { gate } = useAccount();
  if (!opensRestrictedPaths(gate)) return <Redirect href="/" />;
  return <ExportScreen back={{ label: 'Back', onPress: () => (router.canGoBack() ? router.back() : router.replace('/')) }} />;
}
