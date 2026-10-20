import { router } from 'expo-router';
import { Volume2 } from 'lucide-react-native';

import { useFeedbackSettings } from '@/feedback/FeedbackProvider';
import { Group, ListRow, SettingsScreen } from '@/settings/SettingsParts';
import { soundAndHapticsSummary } from '@/settings/summary';

/** Settings. Spec 1 has Sound & haptics; Account, Plan, Offline & allowance and Learning arrive with later specs. */
export default function SettingsIndex() {
  const { current } = useFeedbackSettings();
  return (
    <SettingsScreen title="Settings" back={{ label: 'More', onPress: () => router.dismissTo('/more') }}>
      <Group>
        <ListRow
          icon={Volume2}
          title="Sound & haptics"
          detail={soundAndHapticsSummary(current)}
          onPress={() => router.navigate('/more/settings/sound-and-haptics')}
        />
      </Group>
    </SettingsScreen>
  );
}
