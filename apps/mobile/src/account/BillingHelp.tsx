// Billing help on the restricted paths and before deleting (spec 2 Amendments
// 1 C2, 3 §4 and 5 §4): the store's own subscription management and refund
// request pages, in the App Store or Google Play variant for this device
// (STORES, shared with the web account page). Never a purchase, and never a
// claim that anything was canceled or refunded: only the store can say so.

import { STORES, type Store } from '@tableside/account';
import { CreditCard, ReceiptText } from 'lucide-react-native';
import { Linking, Platform } from 'react-native';

import { Group, ListRow } from '@/settings/SettingsParts';

export { STORES, type Store };

/** The store this device buys through. */
export const deviceStore = (): Store => (Platform.OS === 'ios' ? 'app-store' : 'google-play');

/** Manage subscription and Request a refund, at this device's store. */
export function BillingHelpRows() {
  const store = STORES[deviceStore()];
  return (
    <Group>
      <ListRow
        icon={CreditCard}
        title="Manage subscription"
        detail={`In the ${store.name}. Deleting your account doesn't cancel it.`}
        onPress={() => void Linking.openURL(store.manageUrl)}
      />
      <ListRow icon={ReceiptText} title="Request a refund" detail={`Through the ${store.name}, which decides refunds.`} onPress={() => void Linking.openURL(store.refundUrl)} />
    </Group>
  );
}
