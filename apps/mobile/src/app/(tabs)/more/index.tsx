import { router } from 'expo-router';
import { Settings } from 'lucide-react-native';

import { Group, ListRow, SettingsScreen } from '@/settings/SettingsParts';

/** More holds what isn't one of the five main destinations. Strategies (spec 4) and Help join it later. */
export default function More() {
  return (
    <SettingsScreen title="More">
      <Group>
        <ListRow icon={Settings} title="Settings" detail="Sound & haptics" onPress={() => router.navigate('/more/settings')} />
      </Group>
    </SettingsScreen>
  );
}
