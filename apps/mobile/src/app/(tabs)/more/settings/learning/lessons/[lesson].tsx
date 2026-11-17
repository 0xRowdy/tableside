// Spec 3 S3-12 l8pMS, S3-13 JJl51 and Fvlgc; #143
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Placeholder } from '@/components/Placeholder';
import { useLoaded } from '@/hooks/use-loaded';
import { LessonPlayer } from '@/lessons/LessonPlayer';
import { NOT_READY_HINT } from '@/training/challenge-text';
import { LESSONS_TITLE, OPENING_LESSON } from '@/training/lesson-text';
import type { LessonView, TrainingService } from '@/training/service';
import { useTraining } from '@/training/TrainingProvider';

const openOf = (service: TrainingService, lesson: string): Promise<LessonView | null> => service.openLesson(lesson).catch(() => null);

export default function LessonScreen() {
  const { lesson = '' } = useLocalSearchParams<{ lesson: string }>();
  const { service } = useTraining();
  const opened = useLoaded(openOf, service, lesson);
  const [latest, setLatest] = useState<LessonView | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const view = latest?.id === lesson ? latest : opened;

  if (opened === null) return <Placeholder title={LESSONS_TITLE} message={NOT_READY_HINT} />;
  if (!view) return <Placeholder title={LESSONS_TITLE} message={OPENING_LESSON} />;

  const leave = () => router.dismissTo('/more/settings/learning/lessons');
  const save = (operation: () => Promise<LessonView | void>) => {
    setBusy(true);
    void operation()
      .then(
        (next) => {
          setSaveFailed(false);
          if (next) setLatest(next);
          else leave();
        },
        () => setSaveFailed(true),
      )
      .finally(() => setBusy(false));
  };

  return (
    <LessonPlayer
      view={view}
      back={LESSONS_TITLE}
      busy={busy}
      saveFailed={saveFailed}
      actions={{
        onLeave: leave,
        onNext: () => save(() => service.stepForward(lesson, view.step)),
        onBack: () => save(() => service.stepBack(lesson, view.step)),
        onRestart: () => save(() => service.restartLesson(lesson)),
        onFinish: () => save(() => service.completeLesson(lesson)),
        onResume: () => setLatest({ ...view, prompt: null }),
      }}
    />
  );
}
