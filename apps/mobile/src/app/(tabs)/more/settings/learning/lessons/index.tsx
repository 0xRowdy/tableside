// Spec 3 S3-11 sVqX1, LDmev; Lessons › Entry points (S1-02 FxxAj); #143, #145, #149
import { router, useLocalSearchParams } from 'expo-router';

import { LessonCatalog } from '@/lessons/LessonCatalog';
import { attemptHref, lessonHref } from '@/lessons/routes';
import { LEARNING_TITLE } from '@/training/lesson-text';
import { useInstructionWithheld, useLessons } from '@/training/TrainingProvider';

export default function Lessons() {
  const { section } = useLocalSearchParams<{ section?: string }>();
  const { lessons } = useLessons();
  const withheld = useInstructionWithheld();
  const filtered = section && lessons?.some((lesson) => lesson.section === section) ? section : undefined;
  const shown = filtered ? lessons?.filter((lesson) => lesson.section === filtered) : lessons;
  return (
    <LessonCatalog
      lessons={shown}
      back={{ label: LEARNING_TITLE, onPress: () => router.dismissTo('/more/settings/learning') }}
      onOpen={(lesson) => router.navigate(lessonHref(lesson, filtered))}
      checkUnfinished={!!withheld}
      onReturnToAttempt={() => router.navigate(attemptHref)}
    />
  );
}
