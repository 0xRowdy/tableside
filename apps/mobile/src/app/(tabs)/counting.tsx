// Spec 3 Screens; Lessons › Entry points, Structure (Handoff); #158, #132, #145, #133
import { CHALLENGE_LESSONS } from '@tableside/definitions';
import { CHALLENGE_VARIANTS, type ChallengeVariant } from '@tableside/engine';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';

import { Placeholder } from '@/components/Placeholder';
import { CardReview } from '@/counting/CardReview';
import { ChallengeExercise } from '@/counting/ChallengeExercise';
import { ChallengeResults } from '@/counting/ChallengeResults';
import { ChallengeSetupScreen } from '@/counting/ChallengeSetupScreen';
import { CountingHome } from '@/counting/CountingHome';
import { useFeedback } from '@/feedback/FeedbackProvider';
import { useLoaded } from '@/hooks/use-loaded';
import { lessonHref } from '@/lessons/routes';
import { allowanceCopy, COUNTING_TITLE, FINDING_ATTEMPT } from '@/training/challenge-text';
import { setupFor, type ChallengeSetup, type TrainingService, type TrainingSnapshot } from '@/training/service';
import { useLessons, useTraining } from '@/training/TrainingProvider';

const lastSetupOf = (service: TrainingService) => service.lastSetup();
const allowanceOf = async (service: TrainingService, _reloadOnStatus: TrainingSnapshot['status']) => allowanceCopy(await service.allowance());

export default function Counting() {
  const { service, snapshot } = useTraining();
  const feedback = useFeedback();
  const { category, variant } = useLocalSearchParams<{ category?: string; variant?: string }>();
  const { lessons } = useLessons();
  const remembered = useLoaded(lastSetupOf, service);
  // Spec 3 Amendment 4 §2
  const allowance = useLoaded(allowanceOf, service, snapshot.status);
  const [chosen, setChosen] = useState<ChallengeSetup | null>(null);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const catalog = service.listCatalog();
  const entry = catalog.find((item) => item.category === category);
  // Spec 3 Lessons › Structure (Handoff)
  const handedOff = entry && CHALLENGE_VARIANTS.includes(variant as ChallengeVariant) ? { category: entry.category, variant: variant as ChallengeVariant } : null;
  const openLesson = (lesson: string) => router.navigate(lessonHref(lesson));

  // Spec 3 Amendment 4 §6
  useFocusEffect(useCallback(() => () => service.dismissResults(), [service]));

  switch (snapshot.status) {
    case 'loading':
      return <Placeholder title={COUNTING_TITLE} message={FINDING_ATTEMPT} />;
    case 'active':
      return (
        <ChallengeExercise
          view={snapshot.view}
          busy={snapshot.busy}
          saveFailed={snapshot.save === 'failed'}
          onCommand={(command) => void service.submit(command)}
          // Spec 3 Learn, Check and assistance › Malformed input: cue 9
          onInputRejected={() => feedback.cue('input-rejected')}
          onRetrySave={() => void service.retrySave()}
        />
      );
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
          onReview={() => setReviewing(snapshot.record.attemptId)}
          allowance={allowance}
          onRetry={() => {
            const { category: retried, variant } = snapshot.record.groupKey;
            service.dismissResults();
            void service.startAttempt({ category: retried, variant });
          }}
        />
      );
    case 'none': {
      if (!entry) {
        return (
          <CountingHome
            catalog={catalog}
            allowance={allowance}
            lessons={lessons}
            onOpenLesson={openLesson}
            onChoose={(setup) => {
              service.clearProblem();
              setChosen(setup);
              router.setParams({ category: setup.category, variant: undefined });
            }}
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
