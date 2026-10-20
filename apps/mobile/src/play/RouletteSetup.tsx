// Roulette session setup (design frame S1-02 XQukd): free play or guided
// practice, either wheel, editable inside and outside limits, the house edge
// of the wheel's rules and a fresh buy-in. Guided practice picks a built-in
// strategy (or, from spec 4, one of My strategies) and fixes its targets
// before the start. The engine judges whether the strategy fits the table as
// edited; an incompatible pairing is refused naming the requirement, never
// adjusted (S4-13), and opening bets the funds can't cover are explained (tUFpp).

import {
  explainPrescription,
  FUNDING_CEILING,
  initialProgress,
  rouletteLayout,
  strategyTableCompatibility,
  type RouletteSituation,
  type RouletteWheel,
  type StrategyDefinition,
  type TableRequirement,
} from '@tableside/engine';
import { ROULETTE_LIMITS, ROULETTE_STRATEGIES, rouletteHouseEdge, rouletteRules, strategyDefaults } from '@tableside/definitions';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import type { StartProblem } from '@/practice/controller';
import { usePractice } from '@/practice/PracticeProvider';
import { space } from '@/theme/tokens';

import { betsText } from './coaching-text';
import { formatUnits, targetName } from './roulette-text';
import { FundingSection, useFunding, type Opening } from './setup/Funding';
import { GroupFields, LimitsBanner, useLimits } from './setup/Limits';
import type { LimitGroup } from './setup/limit-drafts';
import { ChoiceGroup, FieldLabel, Help, Section, SetupHeader } from './setup/SetupParts';
import { StrategyPicker } from './setup/StrategyPicker';

type Mode = 'free-play' | 'guided';
type Group = 'inside' | 'outside';

const GROUPS: readonly LimitGroup<Group>[] = [
  { key: 'inside', label: 'Inside bets', help: 'Per placement.' },
  { key: 'outside', label: 'Outside bets', help: 'Per placement.' },
];

const WHEELS: readonly { wheel: RouletteWheel; label: string }[] = [
  { wheel: 'single-zero', label: 'Single zero (0)' },
  { wheel: 'double-zero', label: 'Double zero (0, 00)' },
];

/**
 * What the strategy's first spin bets at this table, with funds to spare so
 * the whole opening shows, from the engine's Explain prescription. Null when
 * it opens with no bet.
 */
function strategyOpening(strategy: StrategyDefinition, parameters: Record<string, string>, rules: RouletteSituation['rules']): Opening | null {
  const situation: RouletteSituation = { game: 'roulette', rules, balance: FUNDING_CEILING.toString(), lastPocket: null };
  const explained = explainPrescription(strategy, parameters, situation, initialProgress(strategy));
  if (!explained.ok || explained.explanation.prescription.status !== 'prescribed') return null;
  const { bets } = explained.explanation.prescription;
  const amount = bets.reduce((sum, bet) => sum + BigInt(bet.amount), 0n).toString();
  return { kind: 'strategy', amount, strategyName: strategy.name, bets: betsText(bets) };
}

const smaller = (a: string, b: string) => (BigInt(a) < BigInt(b) ? a : b);

export function RouletteSetup({
  problem,
  problemReason = null,
  busy,
  myStrategies = [],
}: {
  problem: StartProblem | null;
  problemReason?: string | null;
  busy: boolean;
  /** The latest saved revision of each runnable private roulette strategy (spec 4). */
  myStrategies?: readonly StrategyDefinition[];
}) {
  const { controller } = usePractice();
  const [wheel, setWheel] = useState<RouletteWheel>('single-zero');
  const [mode, setMode] = useState<Mode>('free-play');
  const [strategy, setStrategy] = useState<StrategyDefinition>(ROULETTE_STRATEGIES[0] as StrategyDefinition);
  const [choices, setChoices] = useState<Record<string, string>>(strategyDefaults(strategy));
  const limits = useLimits(GROUPS, ROULETTE_LIMITS);
  const accepted = limits.accepted;
  const rules = accepted ? rouletteRules(wheel, accepted) : null;
  const guided = mode === 'guided';
  // Compatibility is judged at the table as edited, once its limits are good.
  const fit = guided && rules ? strategyTableCompatibility(strategy, choices, rules) : null;
  let opening: Opening | null = null;
  if (rules && !guided) opening = { kind: 'table', amount: smaller(rules.limits.inside.min, rules.limits.outside.min) };
  if (rules && fit?.compatible) opening = strategyOpening(strategy, choices, { wheel, limits: rules.limits });
  const funding = useFunding('roulette', opening);
  const chooseStrategy = (next: StrategyDefinition) => {
    setStrategy(next);
    setChoices(strategyDefaults(next));
  };

  // Under a limit the strategy's bets fall outside (S4-13 YwrCf).
  const limitNote = (group: Group): string | null => {
    const layout = rouletteLayout(wheel);
    const failed = fit?.requirements.find(
      (r) => (r.requirement === 'below-minimum' || r.requirement === 'above-maximum') && layout.find((p) => p.target === r.target)?.limitClass === group,
    );
    if (!failed?.amount) return null;
    return `${failed.requirement === 'below-minimum' ? 'Above' : 'Below'} the strategy's ${formatUnits(failed.amount)} bets.`;
  };

  const start = () => {
    if (!accepted) return;
    void funding.start((funds) =>
      controller.start({
        game: 'roulette',
        ...funds,
        wheel,
        limits: accepted,
        ...(guided ? { strategy: { definition: strategy, parameters: choices } } : {}),
      }),
    );
  };

  return (
    <Screen>
      <SetupHeader title="Roulette" subtitle={`New session · ${guided ? 'guided practice' : 'free play'}`} onBack={() => router.navigate('/')} />

      <Section label="HOW DO YOU WANT TO PLAY?">
        <ChoiceGroup
          label="How do you want to play?"
          options={[
            { label: 'Free play', selected: !guided, onPress: () => setMode('free-play') },
            { label: 'Guided practice', selected: guided, onPress: () => setMode('guided') },
          ]}
        />
        {guided && <Help>Guided practice pauses before a move that departs from your strategy, so you can retry or override it.</Help>}
      </Section>

      <Section label="WHEEL">
        <ChoiceGroup label="Wheel" options={WHEELS.map((option) => ({ label: option.label, selected: wheel === option.wheel, onPress: () => setWheel(option.wheel) }))} />
        <Help>
          {wheel === 'single-zero'
            ? 'Even-money bets lose in full when the ball lands on zero.'
            : 'Even-money bets lose in full on 0 or 00. Adds the five-number basket.'}
        </Help>
        <FieldLabel>
          {wheel === 'single-zero'
            ? `House edge on every bet: ${rouletteHouseEdge('single-zero', 'straight')?.percent}%.`
            : `House edge on every bet: ${rouletteHouseEdge('double-zero', 'straight')?.percent}%, except the five-number basket: ${rouletteHouseEdge('double-zero', 'basket')?.percent}%.`}
        </FieldLabel>
        <Help>A property of this wheel&apos;s rules, not a prediction of your results.</Help>
      </Section>

      {guided && (
        <StrategyPicker
          builtIns={ROULETTE_STRATEGIES}
          myStrategies={myStrategies}
          selected={strategy}
          onChoose={chooseStrategy}
          fit={fit}
          describe={(requirement) => requirementText(strategy, requirement)}
          tableParts="the wheel or limits"
        >
          <StrategyParameters definition={strategy} choices={choices} onChange={setChoices} />
        </StrategyPicker>
      )}

      <Section label="TABLE LIMITS">
        {GROUPS.map((group) => (
          <View key={group.key} style={styles.section}>
            <FieldLabel>{group.label}</FieldLabel>
            <GroupFields limits={limits} group={group} showHelp={false} />
            <Help>{limitNote(group.key) ?? group.help}</Help>
          </View>
        ))}
      </Section>

      <FundingSection funding={funding} opening={opening} problem={problem} problemReason={problemReason} />
      <LimitsBanner limits={limits} />

      <Button
        label={guided ? 'Start guided practice' : 'Start free play'}
        stretch
        disabled={busy || !accepted || (fit !== null && !fit.compatible) || funding.short}
        onPress={start}
      />
    </Screen>
  );
}

/** The plain-language requirement a table fails. */
function requirementText(strategy: StrategyDefinition, requirement: TableRequirement): string {
  const bet = requirement.target && requirement.amount ? betsText([{ target: requirement.target, amount: requirement.amount }]) : '';
  switch (requirement.requirement) {
    case 'below-minimum':
      return `${strategy.name} bets ${bet}. This table's minimum for that bet is ${formatUnits(requirement.limit ?? '0')}, so a ${formatUnits(requirement.amount ?? '0')} bet isn't allowed.`;
    case 'above-maximum':
      return `${strategy.name} bets ${bet}. This table's maximum for that bet is ${formatUnits(requirement.limit ?? '0')}.`;
    case 'not-on-layout':
      return `${strategy.name} bets on ${targetName(requirement.target ?? '')}, which this wheel doesn't have.`;
    case 'wheel':
      return `${strategy.name} is written for a different wheel.`;
    case 'invalid-parameter':
      return 'Choose its targets first.';
    default:
      return `${strategy.name} needs ${requirement.requirement}.`;
  }
}

/**
 * The strategy's targets, fixed for the cycle once play starts. A parameter
 * that must differ from another can't take that one's choice.
 */
function StrategyParameters({
  definition,
  choices,
  onChange,
}: {
  definition: StrategyDefinition;
  choices: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}) {
  return (
    <>
      {definition.parameters.map((param) => {
        const taken = definition.parameters.filter((other) => other.distinctFrom === param.id || param.distinctFrom === other.id).map((other) => choices[other.id]);
        return (
          <View key={param.id} style={styles.section}>
            <FieldLabel>{param.label}</FieldLabel>
            <ChoiceGroup
              label={param.label}
              options={param.choices.map((choice) => ({
                label: targetName(choice),
                selected: choices[param.id] === choice,
                disabled: taken.includes(choice),
                disabledHint: 'Already chosen for the other target',
                onPress: () => onChange({ ...choices, [param.id]: choice }),
              }))}
            />
          </View>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  section: { gap: space[2] },
});
