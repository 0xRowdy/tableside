// Craps session setup (design frame S1-02 GAXET): free play or guided
// practice with one of the five craps built-ins (or, from spec 4, one of My
// strategies), standard craps with a choice of maximum odds and field payout,
// editable limits for flat wagers and for hardways and propositions, the
// house edge of every wager under these rules, and a fresh buy-in. The engine
// judges whether the strategy fits the table as edited; an incompatible
// pairing is refused naming the requirement, never adjusted.

import { CRAPS_LIMITS, CRAPS_STRATEGIES, crapsHouseEdge, standardCraps, type CrapsWager } from '@tableside/definitions';
import {
  explainPrescription,
  FIELD_PAYOUTS,
  FUNDING_CEILING,
  initialProgress,
  ODDS_CAPS,
  STANDARD_CRAPS,
  strategyTableCompatibility,
  type CrapsRuleSet,
  type FieldPayout,
  type OddsCap,
  type StrategyDefinition,
  type TableRequirement,
} from '@tableside/engine';
import { router } from 'expo-router';
import { useState } from 'react';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import type { StartProblem } from '@/practice/controller';
import { usePractice } from '@/practice/PracticeProvider';

import { FundingSection, useFunding, type Opening } from './setup/Funding';
import { GroupFields, LimitsBanner, useLimits } from './setup/Limits';
import type { LimitGroup } from './setup/limit-drafts';
import { ChoiceGroup, FieldLabel, Help, Section, SetupHeader } from './setup/SetupParts';
import { limitRequirementText, StrategyPicker } from './setup/StrategyPicker';
import { betsText, CRAPS_WORDS } from './coaching-text';
import { formatUnits } from './units';

type Mode = 'free-play' | 'guided';

/**
 * What the strategy's come-out roll bets at this table, from the engine's
 * Explain prescription, with funds to spare so the whole opening shows. Null
 * when it bets nothing until a point is set.
 */
function strategyOpening(strategy: StrategyDefinition, rules: CrapsRuleSet): Opening | null {
  const explained = explainPrescription(
    strategy,
    {},
    { game: 'craps', rules: { odds: rules.odds, field: rules.field, limits: rules.limits }, balance: FUNDING_CEILING.toString(), point: null, bases: [] },
    initialProgress(strategy),
  );
  if (!explained.ok || explained.explanation.prescription.status !== 'prescribed') return null;
  const { bets } = explained.explanation.prescription;
  const amount = bets.reduce((sum, bet) => sum + BigInt(bet.amount), 0n).toString();
  return { kind: 'strategy', amount, strategyName: strategy.name, bets: betsText(bets, CRAPS_WORDS) };
}

type Group = 'flat' | 'props';

const GROUPS: readonly LimitGroup<Group>[] = [
  {
    key: 'flat',
    label: 'Pass, come, place, buy, lay, field',
    help: 'Per wager or number. Place 6 and 8 go in multiples of 6. Other place numbers go in multiples of 5. Odds follow the maximum odds instead.',
  },
  { key: 'props', label: 'Hardways and propositions', help: 'Per component. The horn is split equally across 2, 3, 11 and 12.' },
];

const FIELD_LABELS: Record<FieldPayout, string> = { 'triple-12': '2 double, 12 triple', 'double-12': '2 and 12 double' };

/** The plain-language requirement a table fails. */
function requirementText(strategy: StrategyDefinition, requirement: TableRequirement): string {
  const limit = limitRequirementText(strategy, requirement, CRAPS_WORDS);
  if (limit) return limit;
  switch (requirement.requirement) {
    case 'stake-increment':
      return `${strategy.name} bets ${formatUnits(requirement.amount ?? '0')} on ${CRAPS_WORDS.targetName(requirement.target ?? '')}, which isn't a stake that bet takes.`;
    case 'odds':
      return `${strategy.name} is written for other maximum odds.`;
    default:
      return `${strategy.name} needs ${requirement.requirement}.`;
  }
}

export function CrapsSetup({
  problem,
  problemReason = null,
  busy,
  myStrategies = [],
}: {
  problem: StartProblem | null;
  problemReason?: string | null;
  busy: boolean;
  /** The latest saved revision of each runnable private craps strategy (spec 4). */
  myStrategies?: readonly StrategyDefinition[];
}) {
  const { controller } = usePractice();
  const [mode, setMode] = useState<Mode>('free-play');
  const [strategy, setStrategy] = useState<StrategyDefinition>(CRAPS_STRATEGIES[0] as StrategyDefinition);
  const guided = mode === 'guided';
  const [odds, setOdds] = useState<OddsCap>(STANDARD_CRAPS.defaults.odds);
  const [field, setField] = useState<FieldPayout>(STANDARD_CRAPS.defaults.field);
  const limits = useLimits(GROUPS, CRAPS_LIMITS);
  const accepted = limits.accepted;
  const rules = standardCraps(odds, field, accepted ?? CRAPS_LIMITS);
  const smallest = accepted ? (BigInt(accepted.props.min) < BigInt(accepted.flat.min) ? accepted.props.min : accepted.flat.min) : null;
  // Compatibility is judged at the table as edited, once its limits are good.
  const fit = guided && accepted ? strategyTableCompatibility(strategy, {}, rules) : null;
  let opening: Opening | null = !guided && smallest ? { kind: 'table', amount: smallest } : null;
  if (fit?.compatible) opening = strategyOpening(strategy, rules);
  const funding = useFunding('craps', opening);
  const edge = (wager: CrapsWager) => crapsHouseEdge(wager, rules);
  const pct = (wager: CrapsWager) => `${edge(wager).percent}%`;
  const flatMin = accepted?.flat.min;

  const start = () => {
    if (!accepted) return;
    void funding.start((funds) =>
      controller.start({ game: 'craps', ...funds, odds, field, limits: accepted, ...(guided ? { strategy: { definition: strategy, parameters: {} } } : {}) }),
    );
  };

  return (
    <Screen>
      <SetupHeader title="Craps" subtitle={`New session · ${guided ? 'guided practice' : 'free play'} · standard craps`} onBack={() => router.navigate('/')} />

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

      {guided && (
        <StrategyPicker
          builtIns={CRAPS_STRATEGIES}
          myStrategies={myStrategies}
          selected={strategy}
          onChoose={setStrategy}
          fit={fit}
          describe={(requirement) => requirementText(strategy, requirement)}
          tableParts="the maximum odds or limits"
        />
      )}

      <Section label="TABLE RULES">
        <FieldLabel>Maximum odds</FieldLabel>
        <ChoiceGroup
          label="Maximum odds"
          options={ODDS_CAPS.map((cap) => ({ label: `${cap} odds`, short: cap, selected: cap === odds, onPress: () => setOdds(cap) }))}
        />
        <Help>Odds behind a line bet pay true odds with no commission. Laid odds are capped by the amount they win.</Help>
        <FieldLabel>Field payout</FieldLabel>
        <ChoiceGroup label="Field payout" options={FIELD_PAYOUTS.map((option) => ({ label: FIELD_LABELS[option], selected: option === field, onPress: () => setField(option) }))} />
        <Help>The field is one roll: 3, 4, 9, 10 and 11 pay even money and 5, 6, 7 and 8 lose.</Help>
      </Section>

      <Section label="TABLE LIMITS">
        {GROUPS.map((group) => (
          <Section key={group.key} label={group.label.toUpperCase()}>
            <GroupFields limits={limits} group={group} />
          </Section>
        ))}
      </Section>

      <Section label="HOUSE EDGE">
        <FieldLabel>
          Pass and come {edge('pass').percent}% · Don&apos;t pass and don&apos;t come {edge('dont-pass').percent}% · Odds 0%
        </FieldLabel>
        <Help>
          With full {odds} odds: pass {edge('pass').withFullOdds}%, don&apos;t pass {edge('dont-pass').withFullOdds}% of all money bet. A property of these
          rules, not a prediction of your results.
        </Help>
        <FieldLabel>
          Place 6 and 8 {pct('place-6')} · 5 and 9 {pct('place-5')} · 4 and 10 {pct('place-4')}
        </FieldLabel>
        <FieldLabel>
          Buy and lay 6 and 8 {pct('buy-6')} · 5 and 9 {pct('buy-5')} · 4 and 10 {pct('buy-4')}
        </FieldLabel>
        <FieldLabel>
          Field {pct('field')} · Hard 6 and 8 {pct('hard-6')} · Hard 4 and 10 {pct('hard-4')}
        </FieldLabel>
        <FieldLabel>
          Two and twelve {pct('prop-2')} · Three and eleven {pct('prop-3')} · Any craps {pct('any-craps')} · Any seven {pct('any-seven')} · Horn {pct('horn')}
        </FieldLabel>
        <Help>
          Per bet decided, with commission at exactly 5%.
          {flatMin !== undefined &&
            ` Rounding it up to a whole unit costs more on small stakes: a buy at the ${formatUnits(flatMin)}-unit minimum is 6 and 8 ${
              crapsHouseEdge('buy-6', rules, flatMin).percent
            }% · 5 and 9 ${crapsHouseEdge('buy-5', rules, flatMin).percent}% · 4 and 10 ${crapsHouseEdge('buy-4', rules, flatMin).percent}%.`}
        </Help>
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
