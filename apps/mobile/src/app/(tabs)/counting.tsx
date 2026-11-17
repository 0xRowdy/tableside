// Spec 3 Screens; Lessons › Entry points, Structure; Attempt lifecycle; Amendment 1 B5
// #158, #132, #145, #133, #134, #135, #146, #140
import { CHALLENGE_LESSONS } from '@tableside/definitions';
import { CHALLENGE_VARIANTS, type ChallengeVariant } from '@tableside/engine';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';

import { Placeholder } from '@/components/Placeholder';
import { UnfinishedSheet } from '@/counting/AttemptSheets';
import { CardReview } from '@/counting/CardReview';
import { ChallengeExercise, exerciseHints } from '@/counting/ChallengeExercise';
import { ChallengeResults } from '@/counting/ChallengeResults';
import { ChallengeSetupScreen } from '@/counting/ChallengeSetupScreen';
import { CountingHome } from '@/counting/CountingHome';
import { RecordsScreen } from '@/counting/RecordsScreen';
import { useFeedback } from '@/feedback/FeedbackProvider';
import { useLoaded } from '@/hooks/use-loaded';
import { ScreenHints } from '@/lessons/FirstUseHints';
import { lessonHref } from '@/lessons/routes';
import { allowanceCopy, COUNTING_TITLE, FINDING_ATTEMPT, NEEDS_UPDATE } from '@/training/challenge-text';
import { setupFor, type ChallengeSetup, type TrainingService, type TrainingSnapshot } from '@/training/service';
import { useLessons, useTraining } from '@/training/TrainingProvider';

const lastSetupOf = (service: TrainingService) => service.lastSetup();
const allowanceOf = async (service: TrainingService, _reloadOnStatus: TrainingSnapshot['status']) => allowanceCopy(await service.allowance());

export default function Counting() {
  const { service, snapshot } = useTraining();
  const feedback = useFeedback();
  const { category, variant, records } = useLocalSearchParams<{ category?: string; variant?: string; records?: string }>();
  const { lessons } = useLessons();
  const remembered = useLoaded(lastSetupOf, service);
  // Spec 3 Amendment 4 §2
  const allowance = useLoaded(allowanceOf, service, snapshot.status);
  const [chosen, setChosen] = useState<ChallengeSetup | null>(null);
  const [reviewing, setReviewing] = useState<string | null>(null);
  // Spec 3 S3-01 Uq05w
  const [browsing, setBrowsing] = useState(false);
  const [next, setNext] = useState<ChallengeSetup | null>(null);
  const catalog = service.listCatalog();
  const entry = catalog.find((item) => item.category === category);
  // Spec 3 Lessons › Structure (Handoff)
  const handedOff = entry && CHALLENGE_VARIANTS.includes(variant as ChallengeVariant) ? { category: entry.category, variant: variant as ChallengeVariant } : null;
  const openLesson = (lesson: string) => router.navigate(lessonHref(lesson));
  // Spec 3 S3-10 OVKkc
  const openRecords = () => router.setParams({ records: '1' });
  const recordsScreen = records === '1' && <RecordsScreen service={service} lessons={lessons} onOpenLesson={openLesson} onBack={() => router.setParams({ records: undefined })} />;

  // Spec 3 Amendment 4 §6; Amendment 1 B5
  useFocusEffect(
    useCallback(
      () => () => {
        service.suspend('navigation');
        service.dismissResults();
      },
      [service],
    ),
  );

  const chooseSetup = (setup: ChallengeSetup) => {
    service.clearProblem();
    setChosen(setup);
    router.setParams({ category: setup.category, variant: undefined });
  };

  switch (snapshot.status) {
    case 'loading':
      return <Placeholder title={COUNTING_TITLE} message={FINDING_ATTEMPT} />;
    // docs/development.md Releases
    case 'needs-update':
      return <Placeholder title={COUNTING_TITLE} message={NEEDS_UPDATE} />;
    case 'active': {
      const { view, hold } = snapshot;
      // Spec 3 Attempt lifecycle › One unfinished attempt; S3-01 Uq05w
      if (browsing && hold?.reached) {
        if (recordsScreen) return recordsScreen;
        return (
          <>
            <CountingHome catalog={catalog} allowance={allowance} lessons={lessons} onOpenLesson={openLesson} onChoose={setNext} onOpenRecords={openRecords} />
            {next && (
              <UnfinishedSheet
                view={view}
                next={next.category}
                busy={snapshot.busy}
                onClose={() => setNext(null)}
                onResume={() => {
                  setNext(null);
                  setBrowsing(false);
                  void service.resume();
                }}
                onEnd={() => {
                  const target = next;
                  setNext(null);
                  setBrowsing(false);
                  void service.end({ showResults: false }).then(() => {
                    if (service.snapshot().status === 'none') chooseSetup(target);
                  });
                }}
              />
            )}
          </>
        );
      }
      return (
        <ScreenHints service={service} ids={exerciseHints(view)}>
          <ChallengeExercise
          view={view}
          busy={snapshot.busy}
          saveFailed={snapshot.save === 'failed'}
          hold={hold}
          timer={snapshot.timer}
          performanceMs={service.performanceMs}
          onCommand={(command) => void service.submit(command)}
          // Spec 3 Learn, Check and assistance › Malformed input: cue 9
          onInputRejected={() => feedback.cue('input-rejected')}
          onRetrySave={() => void service.retrySave()}
          onPause={() => service.pause()}
          onResume={() => void service.resume()}
          onEnd={() => void service.end()}
          onLeave={() => {
            setBrowsing(true);
            router.setParams({ category: undefined, variant: undefined });
          }}
          lesson={lessons?.find((lesson) => lesson.id === CHALLENGE_LESSONS[view.category])}
          onOpenLesson={openLesson}
          />
        </ScreenHints>
      );
    }
    case 'ended':
      if (reviewing === snapshot.record.attemptId) return <CardReview
            record={snapshot.record}
            lesson={lessons?.find((lesson) => lesson.id === CHALLENGE_LESSONS[snapshot.record.groupKey.category])}
            onOpenLesson={openLesson}
            onBack={() => setReviewing(null)}
          />;
      return (
        <ChallengeResults
          record={snapshot.record}
          position={snapshot.position}
          explanation={snapshot.explanation}
          earned={snapshot.earned}
          onReview={() => setReviewing(snapshot.record.attemptId)}
          allowance={allowance}
          onRetry={() => void service.retry()}
        />
      );
    case 'none': {
      if (!entry) {
        if (recordsScreen) return recordsScreen;
        return (
          <CountingHome
            catalog={catalog}
            allowance={allowance}
            lessons={lessons}
            onOpenLesson={openLesson}
            onChoose={chooseSetup}
            onOpenRecords={openRecords}
          />
        );
      }
      const setup = setupFor(entry, [handedOff, chosen, remembered]);
      return (
        <ChallengeSetupScreen
          entry={entry}
          setup={setup}
          allowance={allowance}
          problem={snapshot.problem}
          busy={snapshot.busy}
          lesson={lessons?.find((lesson) => lesson.id === CHALLENGE_LESSONS[entry.category])}
          onOpenLesson={openLesson}
          onChange={(next) => {
            setChosen(next);
            router.setParams({ variant: undefined });
          }}
          onStart={() => void service.startAttempt(setup)}
          onBack={() => {
            service.clearProblem();
            router.setParams({ category: undefined, variant: undefined });
          }}
        />
      );
    }
  }
}
