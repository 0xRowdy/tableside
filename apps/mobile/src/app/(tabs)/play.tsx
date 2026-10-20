import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { AppState } from 'react-native';

import { Button } from '@/components/Button';
import { Placeholder } from '@/components/Placeholder';
import { findGame } from '@/games';
import { RouletteSetup } from '@/play/RouletteSetup';
import { RouletteTable } from '@/play/RouletteTable';
import { SessionResult } from '@/play/SessionResult';
import { SuspendedSession } from '@/play/SuspendedSession';
import { usePractice } from '@/practice/PracticeProvider';

/** Play shows the active practice session's table (or its result), or setup when there is none. */
export default function Play() {
  const game = findGame(useLocalSearchParams<{ game?: string }>().game);
  const { controller, snapshot } = usePractice();

  // Leaving the table suspends the session in its committed phase; coming back resumes it.
  useFocusEffect(
    useCallback(() => {
      void controller.resumeOnReturn();
      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') void controller.resumeOnReturn();
      });
      return () => {
        subscription.remove();
        controller.suspend('navigation');
      };
    }, [controller]),
  );

  switch (snapshot.status) {
    case 'loading':
      return <Placeholder title="Play" message="Finding your practice session…" />;
    case 'active': {
      const { suspension } = snapshot;
      // A suspension that coming back lifts shows the table while it resumes; any other waits for the player.
      if (suspension?.waitsForPlayer) {
        return <SuspendedSession snapshot={snapshot} suspension={suspension} />;
      }
      return <RouletteTable snapshot={snapshot} />;
    }
    case 'completed':
      return (
        <SessionResult
          result={snapshot.result}
          onNewSession={() => {
            controller.dismissResult();
            router.setParams({ game: 'roulette' });
          }}
          onHome={() => {
            controller.dismissResult();
            router.navigate('/');
          }}
        />
      );
    case 'none':
      break;
  }

  if (game?.id === 'roulette') return <RouletteSetup problem={snapshot.problem} problemReason={snapshot.problemReason} busy={snapshot.busy} />;
  if (game) {
    return <Placeholder title={`${game.title} setup`} message="Rule presets, table limits and your buy-in come next." />;
  }
  return (
    <Placeholder title="Play" message="Pick a table on Home to start a practice session.">
      <Button label="Choose a game" onPress={() => router.navigate('/')} />
    </Placeholder>
  );
}
