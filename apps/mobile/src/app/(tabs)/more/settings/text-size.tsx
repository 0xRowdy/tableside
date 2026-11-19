import { router } from 'expo-router';
import { View } from 'react-native';

import { Note, SettingsScreen } from '@/settings/SettingsParts';
import { TextSizeOptions, TextSizePreview } from '@/settings/TextSizeChoices';
import { space } from '@/theme/tokens';
import { useTextSize } from '@/theme/type';

// Spec 1 Amendment 12 §3; S1-12 I886X
export default function TextSize() {
  const { step, choose } = useTextSize();
  return (
    <SettingsScreen title="Text size" back={{ label: 'Settings', onPress: () => router.dismissTo('/more/settings') }}>
      <TextSizePreview />
      <View style={{ height: space[1] }} />
      <TextSizeOptions selected={step} onSelect={(next) => void choose(next)} />
      <Note>Your phone&apos;s text size still applies, and this adds to it. At the very largest combinations, text stops growing so tables still fit.</Note>
      <Note>Stored on this device only. It never affects scoring or records.</Note>
    </SettingsScreen>
  );
}
