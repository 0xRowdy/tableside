// Spec 3 S3-12 l8pMS, aJV2y, pX6CV, JsXMJ, S3-13 JJl51, Fvlgc, ZBpF3, S3-14 SUUN4
// #143, #144, #145, #149; docs/decisions/lessons-entry-points.md
import type { LessonHandoff } from '@tableside/definitions';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Placeholder } from '@/components/Placeholder';
import { useFeedback } from '@/feedback/FeedbackProvider';
import { EXAMPLE_CUES } from '@/feedback/training-cues';
import { useLoaded } from '@/hooks/use-loaded';
import { LessonPlayer } from '@/lessons/LessonPlayer';
import { LessonGate } from '@/lessons/LessonGate';
import { attemptHref, handoffHref, lessonsBack, lessonsHref, placeOf } from '@/lessons/routes';
import { WorkedExample } from '@/lessons/WorkedExample';
import { allowanceCopy, NEEDS_UPDATE, NOT_READY_HINT, type AllowanceCopy } from '@/training/challenge-text';
import { LESSONS_TITLE, OPENING_LESSON } from '@/training/lesson-text';
import type { LessonView, TrainingService } from '@/training/service';
import { useLessonAccess, useTraining } from '@/training/TrainingProvider';

// Spec 3 Lessons › Access, Check protection; #149
const openOf = async (service: TrainingService, lesson: string, open: boolean): Promise<LessonView | null | undefined> => (open ? service.openLesson(lesson).catch(() => null) : undefined);

// Spec 3 Amendment 4 §2
const allowanceOf = async (service: TrainingService, sheet: boolean): Promise<AllowanceCopy | undefined> =>
  sheet ? service.allowance().then(allowanceCopy, () => undefined) : undefined;

export default function LessonScreen() {
  const { lesson = '', ...params } = useLocalSearchParams<{ lesson: string; section?: string; from?: string; all?: string; catalog?: string }>();
  const { service, snapshot } = useTraining();
  const feedback = useFeedback();
  const access = useLessonAccess(lesson);
  const opened = useLoaded(openOf, service, lesson, access?.kind === 'available');
  const [latest, setLatest] = useState<LessonView | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [finished, setFinished] = useState<string | null>(null);
  const sheet = finished === lesson;
  const allowance = useLoaded(allowanceOf, service, sheet);
  const [trying, setTrying] = useState(false);
  const view = latest?.id === lesson ? latest : opened;

  const back = params.catalog === '1' ? { label: LESSONS_TITLE, onPress: () => router.dismissTo(lessonsHref(placeOf(params))) } : lessonsBack(params);
  const leave = back.onPress;
  const about = service.aboutLesson(lesson);

  if (access === null || opened === null || !about) return <Placeholder title={LESSONS_TITLE} message={NOT_READY_HINT} />;
  if (access && access.kind !== 'available') {
    return (
      <LessonGate
        lesson={about}
        access={access}
        back={back.label}
        busy={busy}
        canEnd={snapshot.status === 'active'}
        endBlocked={snapshot.status === 'needs-update' ? NEEDS_UPDATE : snapshot.status === 'active' ? (snapshot.hold?.endBlocked ?? null) : null}
        onLeave={leave}
        onReturnToAttempt={() => router.navigate(attemptHref)}
        onEndAttempt={() => {
          setBusy(true);
          void service.end({ showResults: false }).finally(() => setBusy(false));
        }}
      />
    );
  }
  if (!view) return <Placeholder title={LESSONS_TITLE} message={OPENING_LESSON} />;

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
      router.dismissTo('/counting');
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
      back={back.label}
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
          const cue = view.example && EXAMPLE_CUES[view.example.kind].shown;
          if (cue) feedback.cue(cue);
          setTrying(true);
        },
      }}
    />
  );
}
