// Spec 3 Screens; #158
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';

import { Placeholder } from '@/components/Placeholder';
import { ChallengeExercise } from '@/counting/ChallengeExercise';
import { ChallengeResults } from '@/counting/ChallengeResults';
import { ChallengeSetupScreen } from '@/counting/ChallengeSetupScreen';
import { CountingHome } from '@/counting/CountingHome';
import { useLoaded } from '@/hooks/use-loaded';
import { COUNTING_TITLE, FINDING_ATTEMPT } from '@/training/challenge-text';
import { setupFor, type ChallengeSetup, type TrainingService } from '@/training/service';
import { useTraining } from '@/training/TrainingProvider';

const lastSetupOf = (service: TrainingService) => service.lastSetup();
const allowanceOf = (service: TrainingService, _status: string) => service.allowance();

export default function Counting() {
  const { service, snapshot } = useTraining();
  const { category } = useLocalSearchParams<{ category?: string }>();
  const remembered = useLoaded(lastSetupOf, service);
  // Spec 3 Amendment 4 §2
  const allowance = useLoaded(allowanceOf, service, snapshot.status);
  const [chosen, setChosen] = useState<ChallengeSetup | null>(null);
  const catalog = service.listCatalog();
  const entry = catalog.find((item) => item.category === category);

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
          onRetrySave={() => void service.retrySave()}
        />
      );
    case 'ended':
      return (
        <ChallengeResults
          record={snapshot.record}
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
            onChoose={(setup) => {
              service.clearProblem();
              setChosen(setup);
              router.setParams({ category: setup.category });
            }}
          />
        );
      }
      const setup = setupFor(entry, [chosen, remembered]);
      return (
        <ChallengeSetupScreen
          entry={entry}
          setup={setup}
          allowance={allowance}
          problem={snapshot.problem}
          busy={snapshot.busy}
          onChange={setChosen}
          onStart={() => void service.startAttempt(setup)}
          onBack={() => {
            service.clearProblem();
            router.setParams({ category: undefined });
          }}
        />
      );
    }
  }
}
