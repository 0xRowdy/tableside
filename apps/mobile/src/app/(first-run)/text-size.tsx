import { router } from 'expo-router';
import { View } from 'react-native';

import { FirstRunScreen } from '@/account/FirstRunParts';
import { Button } from '@/components/Button';
import { TextSizeOptions, TextSizePreview } from '@/settings/TextSizeChoices';
import { space } from '@/theme/tokens';
import { useTextSize } from '@/theme/type';

// Spec 2 Amendment 10 §2; S2-16 Np7f0
export default function FirstRunTextSize() {
  const { step, choose } = useTextSize();
  return (
    <FirstRunScreen title="Choose a text size" intro="Pick what's comfortable to read. You can change it any time in More › Settings.">
      <TextSizePreview />
      <TextSizeOptions selected={step} onSelect={(next) => void choose(next)} />
      <View style={{ height: space[3] }} />
      <Button
        label="Continue"
        stretch
        onPress={() => {
          void choose(step);
          router.replace('/welcome');
        }}
      />
    </FirstRunScreen>
  );
}
