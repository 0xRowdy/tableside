// The Account entries later tickets build: Delete account (S2-22, #103) and
// Display name (spec 6). Each holds its place here until its own route replaces it.

import { Redirect, router, useLocalSearchParams } from 'expo-router';

import { Note, SettingsScreen } from '@/settings/SettingsParts';

const AREAS: Readonly<Record<string, string>> = {
  'display-name': 'Display name',
  delete: 'Delete account',
};

export default function AccountArea() {
  const { area } = useLocalSearchParams<{ area: string }>();
  const title = AREAS[area];
  if (!title) return <Redirect href="/more/settings/account" />;
  return (
    <SettingsScreen title={title} back={{ label: 'Account', onPress: () => router.dismissTo('/more/settings/account') }}>
      <Note>This part of your account is on the way.</Note>
    </SettingsScreen>
  );
}
