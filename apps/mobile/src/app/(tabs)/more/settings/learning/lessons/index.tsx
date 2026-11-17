// Spec 3 S3-11 sVqX1; Lessons › Entry points (S1-02 FxxAj); #143, #145
import { router, useLocalSearchParams } from 'expo-router';

import { LessonCatalog } from '@/lessons/LessonCatalog';
import { lessonHref } from '@/lessons/routes';
import { LEARNING_TITLE } from '@/training/lesson-text';
import { useLessons } from '@/training/TrainingProvider';

export default function Lessons() {
  const { section } = useLocalSearchParams<{ section?: string }>();
  const { lessons } = useLessons();
  const filtered = section && lessons?.some((lesson) => lesson.section === section) ? section : undefined;
  const shown = filtered ? lessons?.filter((lesson) => lesson.section === filtered) : lessons;
  return (
    <LessonCatalog
      lessons={shown}
      back={{ label: LEARNING_TITLE, onPress: () => router.dismissTo('/more/settings/learning') }}
      onOpen={(lesson) => router.navigate(lessonHref(lesson, filtered))}
    />
  );
}
