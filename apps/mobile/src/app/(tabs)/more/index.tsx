import { router } from 'expo-router';
import { Settings } from 'lucide-react-native';

import { Group, ListRow, SettingsScreen } from '@/settings/SettingsParts';

// TODO(spec 4)
// TODO(spec 4 Strategies, spec 7 Help & support)
export default function More() {
  return (
    <SettingsScreen title="More">
      <Group>
        <ListRow icon={Settings} title="Settings" detail="Account, sound & haptics" onPress={() => router.navigate('/more/settings')} />
      </Group>
    </SettingsScreen>
  );
}
