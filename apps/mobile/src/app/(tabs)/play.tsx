import type { ActivitySpecification, BlackjackPermittedView, RoulettePermittedView } from '@tableside/engine';
import { router, useLocalSearchParams } from 'expo-router';

import { Button } from '@/components/Button';
import { Placeholder } from '@/components/Placeholder';
import { findGame } from '@/games';
import { BlackjackSetup } from '@/play/BlackjackSetup';
import { BlackjackTable } from '@/play/BlackjackTable';
import { RouletteSetup } from '@/play/RouletteSetup';
import { RouletteTable } from '@/play/RouletteTable';
import { SessionResult } from '@/play/SessionResult';
import type { ActiveSnapshot } from '@/practice/controller';
import { usePractice } from '@/practice/PracticeProvider';

/** "Blackjack · free play · S17 · LS", "Roulette · free play · single zero". */
function resultSubtitle(specification: ActivitySpecification): string {
  if (specification.game === 'blackjack') {
    const { dealer, lateSurrender } = specification.rules;
    return `Blackjack · free play · ${dealer} · ${lateSurrender ? 'LS' : 'no LS'}`;
  }
  return 'Roulette · free play · single zero';
}

const isBlackjack = (snapshot: ActiveSnapshot): snapshot is ActiveSnapshot<BlackjackPermittedView> => snapshot.view.game === 'blackjack';

/** Play shows the active practice session's table (or its result), or setup when there is none. */
export default function Play() {
  const game = findGame(useLocalSearchParams<{ game?: string }>().game);
  const { controller, snapshot } = usePractice();

  switch (snapshot.status) {
    case 'loading':
      return <Placeholder title="Play" message="Finding your practice session…" />;
    case 'active':
      return isBlackjack(snapshot) ? (
        <BlackjackTable snapshot={snapshot} />
      ) : (
        <RouletteTable snapshot={snapshot as ActiveSnapshot<RoulettePermittedView>} />
      );
    case 'completed':
      return (
        <SessionResult
          result={snapshot.result}
          subtitle={resultSubtitle(snapshot.specification)}
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
  if (game?.id === 'blackjack') return <BlackjackSetup problem={snapshot.problem} busy={snapshot.busy} />;
  if (game) {
    return <Placeholder title={`${game.title} setup`} message="Rule presets, table limits and your buy-in come next." />;
  }
  return (
    <Placeholder title="Play" message="Pick a table on Home to start a practice session.">
      <Button label="Choose a game" onPress={() => router.navigate('/')} />
    </Placeholder>
  );
}
