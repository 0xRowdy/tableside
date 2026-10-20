import { router, useLocalSearchParams } from 'expo-router';

import { Button } from '@/components/Button';
import { Placeholder } from '@/components/Placeholder';
import { findGame } from '@/games';

/** Play shows the active practice session's table, or setup for the chosen game. Setup is not built yet. */
export default function Play() {
  const game = findGame(useLocalSearchParams<{ game?: string }>().game);

  if (game) {
    return <Placeholder title={`${game.title} setup`} message="Rule presets, table limits and your buy-in come next." />;
  }
  return (
    <Placeholder title="Play" message="Pick a table on Home to start a practice session.">
      <Button label="Choose a game" onPress={() => router.navigate('/')} />
    </Placeholder>
  );
}
