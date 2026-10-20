import { router, useLocalSearchParams } from 'expo-router';

import { Button } from '@/components/Button';
import { Placeholder } from '@/components/Placeholder';
import { findGame } from '@/games';
import { CrapsSetup } from '@/play/CrapsSetup';
import { CrapsTable } from '@/play/CrapsTable';
import { RouletteSetup } from '@/play/RouletteSetup';
import { RouletteTable } from '@/play/RouletteTable';
import { SessionResult } from '@/play/SessionResult';
import { usePractice } from '@/practice/PracticeProvider';

/** Play shows the active practice session's table (or its result), or setup when there is none. */
export default function Play() {
  const game = findGame(useLocalSearchParams<{ game?: string }>().game);
  const { controller, snapshot } = usePractice();

  switch (snapshot.status) {
    case 'loading':
      return <Placeholder title="Play" message="Finding your practice session…" />;
    case 'active':
      return snapshot.view.game === 'craps' ? (
        <CrapsTable snapshot={{ ...snapshot, view: snapshot.view }} />
      ) : (
        <RouletteTable snapshot={{ ...snapshot, view: snapshot.view }} />
      );
    case 'completed':
      return (
        <SessionResult
          result={snapshot.result}
          onNewSession={() => {
            controller.dismissResult();
            router.setParams({ game: snapshot.result.game });
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

  if (game?.id === 'roulette') return <RouletteSetup problem={snapshot.problem} busy={snapshot.busy} />;
  if (game?.id === 'craps') return <CrapsSetup problem={snapshot.problem} busy={snapshot.busy} />;
  if (game) {
    return <Placeholder title={`${game.title} setup`} message="Rule presets, table limits and your buy-in come next." />;
  }
  return (
    <Placeholder title="Play" message="Pick a table on Home to start a practice session.">
      <Button label="Choose a game" onPress={() => router.navigate('/')} />
    </Placeholder>
  );
}
