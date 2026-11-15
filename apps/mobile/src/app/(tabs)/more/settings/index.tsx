import { router } from 'expo-router';
import { CircleUser, Volume2 } from 'lucide-react-native';

import { methodsSummary } from '@/account/account-text';
import { useAccountOverview } from '@/account/use-account-summary';
import { useFeedbackSettings } from '@/feedback/FeedbackProvider';
import { Group, ListRow, SettingsScreen } from '@/settings/SettingsParts';
import { soundAndHapticsSummary } from '@/settings/summary';

/** Settings (design frame "Settings"). Plan, Offline & allowance (spec 5) and Learning (spec 3) join it with their specs. */
export default function SettingsIndex() {
  const { current } = useFeedbackSettings();
  const overview = useAccountOverview();
  const summary = overview?.summary;
  const accountDetail =
    summary && overview
      ? `${methodsSummary(summary.methods)} · ${overview.waiting === 0 ? 'synced' : `${overview.waiting} waiting to sync`}`
      : 'Methods, devices, sync, export, delete';
  return (
    <SettingsScreen title="Settings" back={{ label: 'More', onPress: () => router.dismissTo('/more') }}>
      <Group>
        <ListRow icon={CircleUser} title="Account" detail={accountDetail} onPress={() => router.navigate('/more/settings/account')} />
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
