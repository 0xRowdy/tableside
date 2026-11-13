// The offline game choice, the last first-run step before Home: every account,
// premium included, picks the game it can practice offline (spec 2 Amendment
// 3 §4). Spec 5 owns the choice's rules and syncs it.
// TODO(frames): unverified against S2-16 (Pencil couldn't open Tableside.pen for #88).

import { Redirect } from 'expo-router';
import { useState } from 'react';

import { isSignedIn, useAccount } from '@/account/AccountProvider';
import { Actions, ChoiceGroup, ChoiceRow, FirstRunScreen, InlineMessage } from '@/account/FirstRunParts';
import { Button } from '@/components/Button';
import { LAUNCH_GAMES, type GameId } from '@/games';

const QUESTION = 'Choose your offline game';

export default function OfflineGame() {
  const { gate, offlineGame, chooseOfflineGame } = useAccount();
  const [game, setGame] = useState<GameId | null>(null);
  const [failed, setFailed] = useState(false);

  if (!isSignedIn(gate)) return <Redirect href="/welcome" />;
  if (offlineGame) return <Redirect href="/" />;

  const choose = async () => {
    if (!game) return;
    setFailed(false);
    // Once chosen, the layout moves on to Home.
    await chooseOfflineGame(game).catch(() => setFailed(true));
  };

  return (
    <FirstRunScreen title={QUESTION} intro="Without a connection, you can practice one game. Pick the one you want to have with you.">
      <ChoiceGroup label={QUESTION}>
        {LAUNCH_GAMES.map((option) => (
          <ChoiceRow key={option.id} label={option.title} detail={option.summary} selected={game === option.id} onPress={() => setGame(option.id)} />
        ))}
      </ChoiceGroup>
      {failed && <InlineMessage>{"Couldn't save your choice. Try again."}</InlineMessage>}
      <Actions>
        <Button label="Continue" stretch disabled={!game} onPress={() => void choose()} />
      </Actions>
    </FirstRunScreen>
  );
}
