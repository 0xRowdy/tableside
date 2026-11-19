// Spec 3 S3-11 klT0u, f6mxz, LDmev; #143, #145, #149; docs/decisions/lessons-entry-points.md
import { router, useLocalSearchParams } from 'expo-router';

import { LessonCatalog } from '@/lessons/LessonCatalog';
import { attemptHref, lessonHref, lessonsBack, placeOf } from '@/lessons/routes';
import { useInstructionWithheld, useLessons } from '@/training/TrainingProvider';

export default function Lessons() {
  const params = useLocalSearchParams<{ section?: string; from?: string; all?: string }>();
  const { lessons } = useLessons();
  const withheld = useInstructionWithheld();
  const filtered = params.all === '1' ? undefined : lessons?.find((lesson) => lesson.section === params.section)?.section;
  const shown = filtered ? lessons?.filter((lesson) => lesson.section === filtered) : lessons;
  const place = placeOf(params);
  return (
    <LessonCatalog
      lessons={shown}
      filter={filtered && lessons && shown ? { section: filtered, shown: shown.length, total: lessons.length, onShowAll: () => router.setParams({ all: '1' }) } : null}
      back={lessonsBack(params)}
      onOpen={(lesson) => router.navigate(lessonHref(lesson, { ...place, catalog: true }))}
      checkUnfinished={!!withheld}
      onReturnToAttempt={() => router.navigate(attemptHref)}
    />
  );
}
