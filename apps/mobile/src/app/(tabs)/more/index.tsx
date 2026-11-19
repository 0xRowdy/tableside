import { router } from 'expo-router';
import { Settings, Users } from 'lucide-react-native';

import { Group, ListRow, SettingsScreen } from '@/settings/SettingsParts';

// TODO(spec 4)
// TODO(spec 4 Strategies, spec 7 Help & support)
export default function More() {
  return (
    <SettingsScreen title="More">
      {/* Spec 2 Amendment 10 §1; S1 More HNqKQ */}
      <Group>
        <ListRow icon={Users} title="Community" detail="Strategies shared by other players" onPress={() => router.navigate('/more/community')} />
      </Group>
      <Group>
        <ListRow icon={Settings} title="Settings" detail="Account, sound & haptics, text size, learning" onPress={() => router.navigate('/more/settings')} />
      </Group>
    </SettingsScreen>
  );
}
