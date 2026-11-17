// Spec 2 S2-22

import { router } from 'expo-router';

import { DeleteAccountScreen } from '@/account/DeleteAccountScreen';

export default function AccountDelete() {
  return (
    <DeleteAccountScreen
      back={{ label: 'Account', onPress: () => router.dismissTo('/more/settings/account') }}
      onExport={() => router.navigate('/more/settings/account/export')}
    />
  );
}
