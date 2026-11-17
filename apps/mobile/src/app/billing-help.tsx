// Spec 2 Amendment 5 §4
// TODO(spec 2 S2-22)

import { Redirect, router } from 'expo-router';

import { useAccount } from '@/account/AccountProvider';
import { BillingHelpRows } from '@/account/BillingHelp';
import { Note, SettingsScreen } from '@/settings/SettingsParts';
import { opensRestrictedPaths } from '@tableside/account';

export default function BillingHelp() {
  const { gate } = useAccount();
  if (!opensRestrictedPaths(gate)) return <Redirect href="/" />;
  return (
    <SettingsScreen title="Billing help" back={{ label: 'Back', onPress: () => (router.canGoBack() ? router.back() : router.replace('/')) }}>
      <Note>{"Subscriptions are managed, and refunds decided, by the store you bought through. Deleting your account doesn't cancel a subscription."}</Note>
      <BillingHelpRows />
    </SettingsScreen>
  );
}
