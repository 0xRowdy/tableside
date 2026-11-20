// Spec 3 Amendment 1 D, C7; Settings › Learning OEkKV; #146; docs/decisions/lessons-entry-points.md
import { router } from 'expo-router';
import { BookOpen, Lightbulb } from 'lucide-react-native';
import { AccessibilityInfo } from 'react-native';

import { SwitchRow } from '@/components/SwitchRow';
import { Group, GroupLabel, ListRow, Note, SettingsScreen } from '@/settings/SettingsParts';
import { HINTS_AGAIN, HINTS_AGAIN_DETAIL, HINTS_LABEL, HINTS_RESET, LEARNING_NOTE, LEARNING_TITLE, LESSONS_ON_COUNTING, START_HERE_SETTING, startHereDetail } from '@/training/lesson-text';
import { useLearning } from '@/training/TrainingProvider';

export default function Learning() {
  const { service, learning } = useLearning();
  return (
    <SettingsScreen title={LEARNING_TITLE} back={{ label: 'Settings', onPress: () => router.dismissTo('/more/settings') }}>
      <Group>
        <ListRow icon={BookOpen} title={LESSONS_ON_COUNTING} onPress={() => router.navigate('/counting')} />
      </Group>
      <Group>
        <SwitchRow
          title={START_HERE_SETTING}
          detail={startHereDetail(learning?.startHere ?? true)}
          value={learning?.startHere ?? true}
          disabled={learning === undefined}
          onChange={(shown) => void service.setStartHere(shown)}
        />
      </Group>
      <GroupLabel>{HINTS_LABEL}</GroupLabel>
      <Group>
        <ListRow
          icon={Lightbulb}
          title={HINTS_AGAIN}
          detail={HINTS_AGAIN_DETAIL}
          chevron={false}
          onPress={() => {
            void service.resetHints();
            AccessibilityInfo.announceForAccessibility(HINTS_RESET);
          }}
        />
      </Group>
      <Note>{LEARNING_NOTE}</Note>
    </SettingsScreen>
  );
}
