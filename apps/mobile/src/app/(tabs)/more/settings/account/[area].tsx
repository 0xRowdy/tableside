// The Account entries later spec 2 tickets build: Sign-in methods (S2-18, #100),
// Devices (S2-19, #101), Sync status (S2-20, #92), Export (S2-21), Delete
// account (S2-22), Download all history, and Display name (spec 6). Each holds
// its place here until its own route replaces it.

import { Redirect, router, useLocalSearchParams } from 'expo-router';

import { Note, SettingsScreen } from '@/settings/SettingsParts';

const AREAS: Readonly<Record<string, string>> = {
  'display-name': 'Display name',
  'sign-in-methods': 'Sign-in methods',
  devices: 'Devices',
  sync: 'Sync status',
  'download-history': 'Download all history',
  export: 'Export my data',
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
