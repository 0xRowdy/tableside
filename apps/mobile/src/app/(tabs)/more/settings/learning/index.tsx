// Spec 3 Amendment 1 D, C7; Lessons › Entry points; Settings › Learning NvGyZ; #143, #146
import { router } from 'expo-router';
import { Library, Lightbulb } from 'lucide-react-native';
import { useState } from 'react';

import { SwitchRow } from '@/components/SwitchRow';
import { Group, GroupLabel, ListRow, Note, SettingsScreen } from '@/settings/SettingsParts';
import {
  CATALOG_ROW,
  catalogSummary,
  FINDING_LESSONS,
  HINTS_AGAIN,
  HINTS_LABEL,
  hintsAgainDetail,
  LEARNING_NOTE,
  LEARNING_TITLE,
  LESSONS_LABEL,
  START_HERE_SETTING,
  startHereDetail,
} from '@/training/lesson-text';
import { useLearning, useLessons } from '@/training/TrainingProvider';

export default function Learning() {
  const { lessons } = useLessons();
  const { service, learning } = useLearning();
  const [hintsReset, setHintsReset] = useState(false);
  return (
    <SettingsScreen title={LEARNING_TITLE} back={{ label: 'Settings', onPress: () => router.dismissTo('/more/settings') }}>
      <GroupLabel>{LESSONS_LABEL}</GroupLabel>
      <Group>
        <ListRow
          icon={Library}
          title={CATALOG_ROW}
          detail={lessons ? catalogSummary(lessons) : FINDING_LESSONS}
          onPress={() => router.navigate('/more/settings/learning/lessons')}
        />
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
          detail={hintsAgainDetail(hintsReset)}
          chevron={false}
          onPress={() => {
            setHintsReset(true);
            void service.resetHints();
          }}
        />
      </Group>
      <Note>{LEARNING_NOTE}</Note>
    </SettingsScreen>
  );
}
