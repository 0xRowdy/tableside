// Spec 2 Amendment 3 §4
// TODO(spec 2 S2-16)

import { Redirect } from 'expo-router';
import { useState } from 'react';

import { isAgeRestricted, opensOrdinaryAccess, useAccount } from '@/account/AccountProvider';
import { Actions, ChoiceGroup, ChoiceRow, FirstRunScreen, InlineMessage } from '@/account/FirstRunParts';
import { Button } from '@/components/Button';
import { LAUNCH_GAMES, type GameId } from '@/games';

const QUESTION = 'Choose your offline game';

export default function OfflineGame() {
  const { gate, offlineGame, selectOfflineGame } = useAccount();
  const [game, setGame] = useState<GameId | null>(null);
  const [failed, setFailed] = useState(false);

  if (isAgeRestricted(gate)) return <Redirect href="/" />;
  if (!opensOrdinaryAccess(gate)) return <Redirect href="/welcome" />;
  if (offlineGame) return <Redirect href="/" />;

  const select = async () => {
    if (!game) return;
    setFailed(false);
    await selectOfflineGame(game).catch(() => setFailed(true));
  };

  return (
    <FirstRunScreen title={QUESTION} intro="Without a connection, you can practice one game. Pick the one you want to have with you.">
      <ChoiceGroup label={QUESTION}>
        {LAUNCH_GAMES.map((option) => (
          <ChoiceRow key={option.id} label={option.title} detail={option.summary}
            spokenDetail={option.spokenSummary} selected={game === option.id} onPress={() => setGame(option.id)} />
        ))}
      </ChoiceGroup>
      {failed && <InlineMessage>{"Couldn't save your choice. Try again."}</InlineMessage>}
      <Actions>
        <Button label="Continue" stretch disabled={!game} onPress={() => void select()} />
      </Actions>
    </FirstRunScreen>
  );
}
