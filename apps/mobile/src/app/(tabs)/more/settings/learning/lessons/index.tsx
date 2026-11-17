// Spec 3 S3-11 sVqX1; #143
import { router } from 'expo-router';

import { LessonCatalog } from '@/lessons/LessonCatalog';
import { LEARNING_TITLE } from '@/training/lesson-text';
import { useLessons } from '@/training/TrainingProvider';

export default function Lessons() {
  const { lessons } = useLessons();
  return (
    <LessonCatalog
      lessons={lessons}
      back={{ label: LEARNING_TITLE, onPress: () => router.dismissTo('/more/settings/learning') }}
      onOpen={(lesson) => router.navigate({ pathname: '/more/settings/learning/lessons/[lesson]', params: { lesson } })}
    />
  );
}
