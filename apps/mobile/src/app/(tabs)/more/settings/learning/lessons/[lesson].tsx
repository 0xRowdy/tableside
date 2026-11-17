// Spec 3 S3-12 l8pMS, aJV2y, pX6CV, S3-13 JJl51, Fvlgc, ZBpF3; #143, #144, #145
import type { LessonHandoff } from '@tableside/definitions';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Placeholder } from '@/components/Placeholder';
import { useFeedback } from '@/feedback/FeedbackProvider';
import { CONTENT_SHOWN_CUE } from '@/feedback/training-cues';
import { useLoaded } from '@/hooks/use-loaded';
import { LessonPlayer } from '@/lessons/LessonPlayer';
import { handoffHref, lessonsHref } from '@/lessons/routes';
import { WorkedExample } from '@/lessons/WorkedExample';
import { allowanceCopy, NOT_READY_HINT, type AllowanceCopy } from '@/training/challenge-text';
import { LESSONS_TITLE, OPENING_LESSON } from '@/training/lesson-text';
import type { LessonView, TrainingService } from '@/training/service';
import { useTraining } from '@/training/TrainingProvider';

const openOf = (service: TrainingService, lesson: string): Promise<LessonView | null> => service.openLesson(lesson).catch(() => null);

// Spec 3 Amendment 4 §2
const allowanceOf = async (service: TrainingService, sheet: boolean): Promise<AllowanceCopy | undefined> =>
  sheet ? service.allowance().then(allowanceCopy, () => undefined) : undefined;

export default function LessonScreen() {
  const { lesson = '', section } = useLocalSearchParams<{ lesson: string; section?: string }>();
  const { service } = useTraining();
  const feedback = useFeedback();
  const opened = useLoaded(openOf, service, lesson);
  const [latest, setLatest] = useState<LessonView | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [finished, setFinished] = useState<string | null>(null);
  const sheet = finished === lesson;
  const allowance = useLoaded(allowanceOf, service, sheet);
  const [trying, setTrying] = useState(false);
  const view = latest?.id === lesson ? latest : opened;

  if (opened === null) return <Placeholder title={LESSONS_TITLE} message={NOT_READY_HINT} />;
  if (!view) return <Placeholder title={LESSONS_TITLE} message={OPENING_LESSON} />;

  const leave = () => router.dismissTo(lessonsHref(section));
  const save = (operation: () => Promise<LessonView | void>, then: () => void = leave) => {
    setBusy(true);
    void operation()
      .then(
        (next) => {
          setSaveFailed(false);
          if (next) setLatest(next);
          else then();
        },
        () => setSaveFailed(true),
      )
      .finally(() => setBusy(false));
  };
  // Spec 3 Lessons › Structure (Handoff)
  const handOff = (handoff: LessonHandoff) => {
    const open = () => {
      leave();
      router.navigate(handoffHref(handoff));
    };
    if (sheet) open();
    else save(() => service.completeLesson(lesson), open);
  };

  if (trying && view.example) {
    const { step } = view.example;
    return (
      <WorkedExample
        example={view.example}
        lesson={view.title}
        busy={busy}
        onBack={() => setTrying(false)}
        onDone={() => {
          setTrying(false);
          save(() => service.stepForward(lesson, step));
        }}
      />
    );
  }

  return (
    <LessonPlayer
      view={view}
      back={LESSONS_TITLE}
      busy={busy}
      saveFailed={saveFailed}
      handoffSheet={sheet ? { allowance } : null}
      actions={{
        onLeave: leave,
        onNext: () => save(() => service.stepForward(lesson, view.step)),
        onBack: () => save(() => service.stepBack(lesson, view.step)),
        onRestart: () => save(() => service.restartLesson(lesson)),
        onFinish: () => save(() => service.completeLesson(lesson), view.handoffs.length > 0 ? () => setFinished(lesson) : leave),
        onResume: () => setLatest({ ...view, prompt: null }),
        onHandoff: handOff,
        onExample: () => {
          feedback.cue(CONTENT_SHOWN_CUE);
          setTrying(true);
        },
      }}
    />
  );
}
