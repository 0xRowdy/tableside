// Billing help on the restricted paths and before deleting (spec 2 Amendments
// 1 C2, 3 §4 and 5 §4): the store's own subscription management and refund
// request pages, in the App Store or Google Play variant for this device.
// Never a purchase, and never a claim that anything was canceled or refunded:
// only the store can say so. Spec 5 owns billing; until then these open the
// store's pages.

import { CreditCard, ReceiptText } from 'lucide-react-native';
import { Linking, Platform } from 'react-native';

import { Group, ListRow } from '@/settings/SettingsParts';

export type Store = 'app-store' | 'google-play';

export const STORES: Readonly<Record<Store, { readonly name: string; readonly manageUrl: string; readonly refundUrl: string }>> = {
  'app-store': {
    name: 'App Store',
    manageUrl: 'https://apps.apple.com/account/subscriptions',
    refundUrl: 'https://reportaproblem.apple.com',
  },
  'google-play': {
    name: 'Google Play',
    manageUrl: 'https://play.google.com/store/account/subscriptions',
    refundUrl: 'https://support.google.com/googleplay/answer/2479637',
  },
};

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
