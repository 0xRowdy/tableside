// TODO(spec 6)

import { Redirect, router, useLocalSearchParams } from 'expo-router';

import { Note, SettingsScreen } from '@/settings/SettingsParts';

const AREAS: Readonly<Record<string, string>> = {
  'display-name': 'Display name',
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
