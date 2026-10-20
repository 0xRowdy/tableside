// Blackjack session setup (design frame S1-02 i1tnq, free play): the four
// named presets, which the dealer and surrender switches also set; penetration
// and other players as steppers; editable initial-wager limits; the house edge
// of these rules; and a fresh buy-in. Guided modes arrive with #77 and #78.

import { BLACKJACK_LIMITS, blackjackHouseEdge, blackjackRules, DEFAULT_PENETRATION, type BlackjackPreset } from '@tableside/definitions';
import { MAX_OTHER_PLAYERS, PENETRATIONS } from '@tableside/engine';
import { router } from 'expo-router';
import { useState } from 'react';
import { useWindowDimensions } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { SwitchRow } from '@/components/SwitchRow';
import type { StartProblem } from '@/practice/controller';
import { usePractice } from '@/practice/PracticeProvider';

import { otherPlayersText } from './blackjack-text';
import { FundingSection, useFunding, type Opening } from './setup/Funding';
import { GroupFields, LimitsBanner, useLimits } from './setup/Limits';
import type { LimitGroup } from './setup/limit-drafts';
import { ChoiceGroup, FieldLabel, Help, Section, SetupHeader, Stepper } from './setup/SetupParts';

const PRESETS: readonly { preset: BlackjackPreset; label: string }[] = [
  { preset: 'S17_LS', label: 'S17 · surrender' },
  { preset: 'S17_noLS', label: 'S17' },
  { preset: 'H17_LS', label: 'H17 · surrender' },
  { preset: 'H17_noLS', label: 'H17' },
];

const GROUPS: readonly LimitGroup<'initial'>[] = [
  { key: 'initial', label: 'Initial wager', help: 'Whole units of 1 or more. Insurance, splits and doubles can go over the maximum.' },
];

/** Above this text scale the preset chips become a list (annotation V0ckk). */
const CHIPS_MAX_FONT_SCALE = 1.35;

export function BlackjackSetup({ problem, problemReason = null, busy }: { problem: StartProblem | null; problemReason?: string | null; busy: boolean }) {
  const { controller } = usePractice();
  const { fontScale } = useWindowDimensions();
  const [preset, setPreset] = useState<BlackjackPreset>('S17_LS');
  const [penetration, setPenetration] = useState(DEFAULT_PENETRATION);
  const [others, setOthers] = useState(0);
  const limits = useLimits(GROUPS, BLACKJACK_LIMITS);
  const hits = preset.startsWith('H17');
  const surrender = preset.endsWith('_LS');
  const setRules = (dealerHits: boolean, lateSurrender: boolean) => setPreset(`${dealerHits ? 'H17' : 'S17'}_${lateSurrender ? 'LS' : 'noLS'}`);
  const accepted = limits.accepted;
  const opening: Opening | null = accepted ? { kind: 'table', amount: accepted.initial.min } : null;
  const funding = useFunding('blackjack', opening);
  const step = PENETRATIONS.indexOf(penetration);

  const start = () => {
    if (!accepted) return;
    const funds = funding.prepare();
    if (funds) void controller.start({ game: 'blackjack', ...funds, rules: blackjackRules(preset, penetration, others, accepted) });
  };

  return (
    <Screen>
      <SetupHeader title="Blackjack" subtitle="New session · free play" onBack={() => router.navigate('/')} />

      <Section label="TABLE RULES">
        <ChoiceGroup
          label="Rule preset"
          stacked={fontScale > CHIPS_MAX_FONT_SCALE}
          options={PRESETS.map((option) => ({ label: option.label, selected: option.preset === preset, onPress: () => setPreset(option.preset) }))}
        />
        <SwitchRow
          title="Dealer hits soft 17"
          detail={hits ? 'On: dealer hits soft 17' : 'Off: dealer stands on all 17s'}
          value={hits}
          onChange={(on) => setRules(on, surrender)}
        />
        <SwitchRow title="Late surrender" detail="After the peek, on your first two cards only" value={surrender} onChange={(on) => setRules(hits, on)} />
        <Stepper
          label="Shoe penetration"
          value={`${penetration}%`}
          detail="dealt before the shuffle · 50–80% in steps of 5"
          decrementLabel="Less shoe penetration"
          incrementLabel="More shoe penetration"
          onDecrement={step > 0 ? () => setPenetration(PENETRATIONS[step - 1] as number) : null}
          onIncrement={step < PENETRATIONS.length - 1 ? () => setPenetration(PENETRATIONS[step + 1] as number) : null}
        />
        <Stepper
          label="Other players at the table"
          value={`${others} player${others === 1 ? '' : 's'}`}
          spoken={otherPlayersText(others)}
          detail="0–4 · they play basic strategy at the table minimum, before you; their cards count toward the shoe"
          decrementLabel="Fewer other players"
          incrementLabel="More other players"
          onDecrement={others > 0 ? () => setOthers(others - 1) : null}
          onIncrement={others < MAX_OTHER_PLAYERS ? () => setOthers(others + 1) : null}
        />
        <Help>Fixed for every preset: 6 decks · blackjack pays 3:2 · dealer peeks · double any two cards, including after splits · split to 4 hands.</Help>
      </Section>

      <Section label="TABLE LIMITS · INITIAL WAGER">
        <GroupFields limits={limits} group={GROUPS[0] as LimitGroup<'initial'>} />
      </Section>

      <Section label="HOUSE EDGE">
        <FieldLabel>House edge with basic strategy: {blackjackHouseEdge(preset).percent}%</FieldLabel>
        <Help>Off the top of a fresh six-deck shoe. A property of these rules, not a prediction of your results.</Help>
      </Section>

      <FundingSection funding={funding} opening={opening} problem={problem} problemReason={problemReason} />
      <LimitsBanner limits={limits} />

      <Button label="Start free play" stretch disabled={busy || !accepted || funding.short} onPress={start} />
    </Screen>
  );
}
