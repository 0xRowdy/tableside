import { blackjackModeOf } from '@tableside/definitions';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { AppState } from 'react-native';

import { Button } from '@/components/Button';
import { Placeholder } from '@/components/Placeholder';
import { Screen } from '@/components/Screen';
import { findGame } from '@/games';
import { useFollow } from '@/hooks/use-follow';
import { ScreenHints } from '@/lessons/FirstUseHints';
import { practicePrefill } from '@/lessons/routes';
import { BlackjackSetup } from '@/play/BlackjackSetup';
import { BLACKJACK_MODE_TEXT } from '@/play/blackjack-text';
import { BlackjackTable } from '@/play/BlackjackTable';
import { CrapsSetup } from '@/play/CrapsSetup';
import { CrapsTable } from '@/play/CrapsTable';
import { EndSessionDialog } from '@/play/EndSessionDialog';
import { TABLE_HINTS } from '@/play/bet-selector/Presentation';
import { IncompleteSession } from '@/play/IncompleteSession';
import { PracticeHold, useModeWithheld } from '@/play/PracticeHold';
import { RouletteSetup } from '@/play/RouletteSetup';
import { RouletteTable } from '@/play/RouletteTable';
import { SessionResult } from '@/play/SessionResult';
import { SetupHeader } from '@/play/setup/SetupParts';
import { SuspendedSession } from '@/play/SuspendedSession';
import type { PracticeController, PracticeSnapshot } from '@/practice/controller';
import { usePractice } from '@/practice/PracticeProvider';
import { useTrainingService } from '@/training/TrainingProvider';

const isSwitched = (snapshot: PracticeSnapshot) =>
  snapshot.status === 'completed' && (snapshot.result.endingReason === 'switch' || snapshot.result.endingReason === 'reset');

// Spec 1 S1-09
function leaveSwitchedResults(controller: PracticeController): () => void {
  const leave = () => {
    if (isSwitched(controller.snapshot())) controller.dismissResult();
  };
  leave();
  return controller.subscribe(leave);
}

export default function Play() {
  const params = useLocalSearchParams<{ game?: string; practice?: string; strategy?: string; schedule?: string }>();
  const game = findGame(params.game);
  // Spec 3 Lessons › Structure (Handoff)
  const prefill = practicePrefill(params);
  const setupKey = `${params.game}:${params.practice ?? ''}:${params.strategy ?? ''}:${params.schedule ?? ''}`;
  const { controller, snapshot } = usePractice();
  const training = useTrainingService();
  const [switchingFrom, setSwitchingFrom] = useState<string | null>(null);
  const activeGame = snapshot.status === 'active' ? snapshot.view.game : null;
  const switchTo = game && activeGame && game.id !== activeGame ? game.id : null;
  const switched = isSwitched(snapshot);
  // Spec 3 Lessons › Check protection; Amendment 1 A2, Amendment 3
  const guidedMode = snapshot.status === 'active' && snapshot.view.game === 'blackjack' && snapshot.view.strategy ? blackjackModeOf(snapshot.view.strategy.id) : null;
  const held = useModeWithheld(guidedMode);
  useFollow(leaveSwitchedResults, controller);

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
      if (held && guidedMode) {
        return (
          <Screen>
            <SetupHeader title="Blackjack" subtitle={`Guided practice · ${BLACKJACK_MODE_TEXT[guidedMode].label}`} onBack={() => router.navigate('/')} />
            <PracticeHold mode={guidedMode} />
          </Screen>
        );
      }
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
      return (
        <>
          {/* Spec 3 Lessons › Structure (First-use hints); #146 */}
          <ScreenHints service={training} ids={TABLE_HINTS}>
            {table}
          </ScreenHints>
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
    case 'incomplete':
      return <IncompleteSession session={snapshot.session} />;
    case 'needs-update':
      return (
        <Placeholder
          title="Update to resume"
          message={`Your ${findGame(snapshot.game)?.title.toLowerCase() ?? 'practice'} session was saved by a newer version of Tableside. Update the app to pick it up exactly where you left off. Nothing has changed.`}
        >
          <Button label="Back to Home" onPress={() => router.navigate('/')} />
        </Placeholder>
      );
    case 'none':
      break;
  }

  const setup = { problem: snapshot.problem, problemReason: snapshot.problemReason, busy: snapshot.busy, prefill };
  if (game?.id === 'roulette') return <RouletteSetup key={setupKey} {...setup} />;
  if (game?.id === 'blackjack') return <BlackjackSetup key={setupKey} {...setup} />;
  if (game?.id === 'craps') return <CrapsSetup key={setupKey} {...setup} />;
  if (game) {
    return <Placeholder title={`${game.title} setup`} message="Rule presets, table limits and your buy-in come next." />;
  }
  return (
    <Placeholder title="Play" message="Pick a table on Home to start a practice session.">
      <Button label="Choose a game" onPress={() => router.navigate('/')} />
    </Placeholder>
  );
}
