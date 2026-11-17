// Spec 2 S2-21

import { router } from 'expo-router';

import { ExportScreen } from '@/account/ExportScreen';

export default function AccountExport() {
  return <ExportScreen back={{ label: 'Account', onPress: () => router.dismissTo('/more/settings/account') }} />;
}
