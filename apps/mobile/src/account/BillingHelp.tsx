// Spec 2 Amendments 1 C2, 3 §4, 5 §4

import { STORES, type Store } from '@tableside/account';
import { CreditCard, ReceiptText } from 'lucide-react-native';
import { Linking, Platform } from 'react-native';

import { Group, ListRow } from '@/settings/SettingsParts';

export { STORES, type Store };

export const deviceStore = (): Store => (Platform.OS === 'ios' ? 'app-store' : 'google-play');

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
