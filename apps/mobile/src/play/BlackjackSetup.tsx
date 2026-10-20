// Blackjack session setup (design frame S1-02 i1tnq): free play or guided
// practice in one of the four modes (basic; basic with deviations; counting
// with basic; counting with deviations), with the optional Hi-Lo bet schedule
// alongside a counting mode; the four named presets, which the dealer and
// surrender switches also set; penetration and other players as steppers;
// editable initial-wager limits; the house edge of these rules; and a fresh
// buy-in. Guided practice pins the preset's built-in strategy; without the
// schedule the bets stay the player's.

import {
  BLACKJACK_LIMITS,
  BLACKJACK_MODES,
  blackjackHouseEdge,
  blackjackRules,
  blackjackStrategy,
  countingMode,
  DEFAULT_PENETRATION,
  type BlackjackMode,
  type BlackjackPreset,
} from '@tableside/definitions';
import { explainPrescription, initialProgress, MAX_OTHER_PLAYERS, PENETRATIONS, strategyTableCompatibility, type StrategyDefinition } from '@tableside/engine';
import { router } from 'expo-router';
import { useState } from 'react';
import { useWindowDimensions } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { SwitchRow } from '@/components/SwitchRow';
import type { StartProblem } from '@/practice/controller';
import { usePractice } from '@/practice/PracticeProvider';

import { otherPlayersText } from './blackjack-text';
import { betsText, BLACKJACK_WORDS } from './coaching-text';
import { limitRequirementText } from './setup/StrategyPicker';
import { FundingSection, useFunding, type Opening } from './setup/Funding';
import { GroupFields, LimitsBanner, useLimits } from './setup/Limits';
import type { LimitGroup } from './setup/limit-drafts';
import { ChoiceGroup, FieldLabel, Help, InlineProblem, Section, SetupHeader, Stepper } from './setup/SetupParts';

const PRESETS: readonly { preset: BlackjackPreset; label: string }[] = [
  { preset: 'S17_LS', label: 'S17 · surrender' },
  { preset: 'S17_noLS', label: 'S17' },
  { preset: 'H17_LS', label: 'H17 · surrender' },
  { preset: 'H17_noLS', label: 'H17' },
];

const GROUPS: readonly LimitGroup<'initial'>[] = [
  { key: 'initial', label: 'Initial wager', help: 'Whole units of 1 or more. Insurance, splits and doubles can go over the maximum.' },
];

/** Each mode as the setup frame words it. */
const MODE_TEXT: Record<BlackjackMode, { label: string; help: (deviations: string) => string }> = {
  basic: { label: 'Basic strategy', help: () => 'Coaches every decision for these table rules. Tableside pauses before a play that departs from it.' },
  'basic-with-deviations': { label: 'Basic with deviations', help: (deviations) => `Adds index plays (${deviations}). Tableside shows you the count before every deal and decision.` },
  'counting-with-basic': { label: 'Counting with basic', help: () => 'You keep the Hi-Lo count. Play is checked against the real count; Tableside never shows it.' },
  'counting-with-deviations': { label: 'Counting with deviations', help: (deviations) => `You keep the count. Basic plus index plays (${deviations}), checked against the real count.` },
};

/** What the bet schedule bets on the first deal of a fresh shoe (a true count of 0), from the engine's Explain prescription. */
function scheduleOpening(strategy: StrategyDefinition, rules: ReturnType<typeof blackjackRules>): Opening | null {
  const situation = {
    game: 'blackjack',
    rules: { dealer: rules.dealer, lateSurrender: rules.lateSurrender, limits: rules.limits },
    balance: '1000000000',
    // A fresh six-deck shoe.
    shoe: { running: 0, remaining: 312 },
  };
  const explained = explainPrescription(strategy, {}, situation, initialProgress(strategy));
  if (!explained.ok || explained.explanation.prescription.status !== 'prescribed') return null;
  const { bets } = explained.explanation.prescription;
  return { kind: 'strategy', amount: bets.reduce((sum, bet) => sum + BigInt(bet.amount), 0n).toString(), strategyName: strategy.name, bets: betsText(bets, BLACKJACK_WORDS) };
}

/** Above this text scale the preset chips become a list (annotation V0ckk). */
const CHIPS_MAX_FONT_SCALE = 1.35;

export function BlackjackSetup({ problem, problemReason = null, busy }: { problem: StartProblem | null; problemReason?: string | null; busy: boolean }) {
  const { controller } = usePractice();
  const { fontScale } = useWindowDimensions();
  const [preset, setPreset] = useState<BlackjackPreset>('S17_LS');
  const [guided, setGuided] = useState(false);
  const [mode, setMode] = useState<BlackjackMode>('basic');
  const [schedule, setSchedule] = useState(false);
  const [penetration, setPenetration] = useState(DEFAULT_PENETRATION);
  const [others, setOthers] = useState(0);
  const limits = useLimits(GROUPS, BLACKJACK_LIMITS);
  const hits = preset.startsWith('H17');
  const surrender = preset.endsWith('_LS');
  const setRules = (dealerHits: boolean, lateSurrender: boolean) => setPreset(`${dealerHits ? 'H17' : 'S17'}_${lateSurrender ? 'LS' : 'noLS'}`);
  const accepted = limits.accepted;
  // The bet schedule goes only with a counting mode; switching away leaves the bets to the player.
  const betSchedule = schedule && countingMode(mode);
  const definition = blackjackStrategy(preset, mode, betSchedule);
  const rules = accepted ? blackjackRules(preset, penetration, others, accepted) : null;
  // A schedule's amounts must fit the edited limits; Tableside never changes them.
  const fit = guided && betSchedule && rules ? strategyTableCompatibility(definition, {}, rules) : null;
  let opening: Opening | null = rules ? { kind: 'table', amount: rules.limits.initial.min } : null;
  if (rules && fit?.compatible) opening = scheduleOpening(definition, rules);
  const funding = useFunding('blackjack', opening);
  const step = PENETRATIONS.indexOf(penetration);
  const deviations = `the certified ${hits ? 'H17' : 'S17'} indices${surrender ? ' and the Fab 4 surrenders' : ''}`;

  const start = () => {
    if (!rules) return;
    const strategy = guided ? { strategy: { definition, parameters: {} } } : {};
    void funding.start((funds) => controller.start({ game: 'blackjack', ...funds, rules, ...strategy }));
  };

  return (
    <Screen>
      <SetupHeader title="Blackjack" subtitle={`New session · ${guided ? 'guided practice' : 'free play'}`} onBack={() => router.navigate('/')} />

      <Section label="HOW DO YOU WANT TO PLAY?">
        <ChoiceGroup
          label="How do you want to play?"
          options={[
            { label: 'Free play', selected: !guided, onPress: () => setGuided(false) },
            { label: 'Guided practice', selected: guided, onPress: () => setGuided(true) },
          ]}
        />
        {guided && (
          <>
            <ChoiceGroup
              label="Strategy"
              stacked
              options={BLACKJACK_MODES.map((option) => ({ label: MODE_TEXT[option].label, detail: MODE_TEXT[option].help(deviations), selected: mode === option, onPress: () => setMode(option) }))}
            />
            {countingMode(mode) ? (
              <SwitchRow
                title="Practice the Hi-Lo bet schedule"
                detail="1 / 2 / 4 / 6 / 8 units of 10 by true count. Scored separately from your play."
                value={schedule}
                onChange={setSchedule}
              />
            ) : null}
            <Help>{betSchedule ? 'Tableside checks each bet against the schedule before the deal.' : 'Your bets are your own; only your play is checked.'}</Help>
            {fit && !fit.compatible && (
              <InlineProblem alert>
                {[...new Set(fit.requirements.map((r) => limitRequirementText(definition, r, BLACKJACK_WORDS) ?? "The bet schedule doesn't fit this table."))].join(' ')} Tableside won&apos;t change the schedule&apos;s amounts: change the limits, or turn the schedule off.
              </InlineProblem>
            )}
          </>
        )}
      </Section>

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

      <Button label={guided ? 'Start guided practice' : 'Start free play'} stretch disabled={busy || !accepted || (fit !== null && !fit.compatible) || funding.short} onPress={start} />
    </Screen>
  );
}
