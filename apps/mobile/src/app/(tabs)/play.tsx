import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { Button } from '@/components/Button';
import { Placeholder } from '@/components/Placeholder';
import { findGame } from '@/games';
import { BlackjackSetup } from '@/play/BlackjackSetup';
import { BlackjackTable } from '@/play/BlackjackTable';
import { CrapsSetup } from '@/play/CrapsSetup';
import { CrapsTable } from '@/play/CrapsTable';
import { EndSessionDialog } from '@/play/EndSessionDialog';
import { RouletteSetup } from '@/play/RouletteSetup';
import { RouletteTable } from '@/play/RouletteTable';
import { SessionResult } from '@/play/SessionResult';
import { SuspendedSession } from '@/play/SuspendedSession';
import { usePractice } from '@/practice/PracticeProvider';

/** Play shows the active practice session's table (or its result), or setup when there is none. */
export default function Play() {
  const game = findGame(useLocalSearchParams<{ game?: string }>().game);
  const { controller, snapshot } = usePractice();
  // The session whose switch the player confirmed; its stop path is then under way.
  const [switchingFrom, setSwitchingFrom] = useState<string | null>(null);
  const activeGame = snapshot.status === 'active' ? snapshot.view.game : null;
  const switchTo = game && activeGame && game.id !== activeGame ? game.id : null;
  const switched = snapshot.status === 'completed' && (snapshot.result.endingReason === 'switch' || snapshot.result.endingReason === 'reset');

  // A switch (or reset) saves the old session's result, then opens setup instead of showing it (S1-09 egZUB).
  useEffect(() => {
    if (switched) controller.dismissResult();
  }, [controller, switched]);

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
      const table =
        snapshot.view.game === 'blackjack' ? (
          <BlackjackTable snapshot={{ ...snapshot, view: snapshot.view }} />
        ) : snapshot.view.game === 'craps' ? (
          <CrapsTable snapshot={{ ...snapshot, view: snapshot.view }} />
        ) : (
          <RouletteTable snapshot={{ ...snapshot, view: snapshot.view }} />
        );
      // Another game picked on Home while this session is open: ending it comes first.
      return (
        <>
          {table}
          {switchTo && (
            <EndSessionDialog
              visible={switchingFrom !== snapshot.view.activityId}
              view={snapshot.view}
              switchTo={switchTo}
              cancelLabel={`Stay at ${snapshot.view.game}`}
              onCancel={() => router.setParams({ game: snapshot.view.game })}
              onConfirm={() => {
                setSwitchingFrom(snapshot.view.activityId);
                void controller.endSession('switch');
              }}
            />
          )}
        </>
      );
    }
    case 'completed':
      if (switched) return <Placeholder title="Play" message="Saving your result…" />;
      return (
        <SessionResult
          record={snapshot.result}
          actions={
            <>
              <Button
                label="New session"
                stretch
                onPress={() => {
                  controller.dismissResult();
                  router.setParams({ game: snapshot.result.game });
                }}
              />
              <Button
                label="Back to Home"
                variant="secondary"
                stretch
                onPress={() => {
                  controller.dismissResult();
                  router.navigate('/');
                }}
              />
            </>
          }
        />
      );
    case 'none':
      break;
  }

  if (game?.id === 'roulette') return <RouletteSetup problem={snapshot.problem} problemReason={snapshot.problemReason} busy={snapshot.busy} />;
  if (game?.id === 'blackjack') return <BlackjackSetup problem={snapshot.problem} problemReason={snapshot.problemReason} busy={snapshot.busy} />;
  if (game?.id === 'craps') return <CrapsSetup problem={snapshot.problem} problemReason={snapshot.problemReason} busy={snapshot.busy} />;
  if (game) {
    return <Placeholder title={`${game.title} setup`} message="Rule presets, table limits and your buy-in come next." />;
  }
  return (
    <Placeholder title="Play" message="Pick a table on Home to start a practice session.">
      <Button label="Choose a game" onPress={() => router.navigate('/')} />
    </Placeholder>
  );
}
