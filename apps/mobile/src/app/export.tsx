// S2-21 Export my data on the restricted paths: an account whose age isn't
// established reaches it from its paused screen, where the tab bar is hidden
// (spec 2 *Age eligibility*). Other gate states have no export here.

import { Redirect, router } from 'expo-router';

import { useAccount } from '@/account/AccountProvider';
import { ExportScreen } from '@/account/ExportScreen';
import { opensRestrictedPaths } from '@tableside/account';

export default function RestrictedExport() {
  const { gate } = useAccount();
  if (!opensRestrictedPaths(gate)) return <Redirect href="/" />;
  return <ExportScreen back={{ label: 'Back', onPress: () => (router.canGoBack() ? router.back() : router.replace('/')) }} />;
}
