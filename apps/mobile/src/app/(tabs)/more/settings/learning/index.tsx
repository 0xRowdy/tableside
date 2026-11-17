// Spec 3 Amendment 1 D; Settings › Learning NvGyZ; #143
import { router } from 'expo-router';
import { Library } from 'lucide-react-native';

import { Group, GroupLabel, ListRow, Note, SettingsScreen } from '@/settings/SettingsParts';
import { CATALOG_ROW, catalogSummary, FINDING_LESSONS, LEARNING_NOTE, LEARNING_TITLE, LESSONS_LABEL } from '@/training/lesson-text';
import { useLessons } from '@/training/TrainingProvider';

export default function Learning() {
  const { lessons } = useLessons();
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
      <Note>{LEARNING_NOTE}</Note>
    </SettingsScreen>
  );
}
