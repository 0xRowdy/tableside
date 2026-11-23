// Spec 1 Amendment 4 B

import { FUNDING_CEILING, type FundingSource } from '@tableside/engine';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { useFeedback } from '@/feedback/FeedbackProvider';
import type { GameId } from '@/games';
import { useLoaded } from '@/hooks/use-loaded';
import { PRACTICE_FUNDING_TERMS, type SetupTerms } from '@/practice/adapters';
import { RECONNECT_TO_VERIFY, type StartProblem } from '@/practice/controller';
import { usePractice } from '@/practice/PracticeProvider';
import { space } from '@/theme/tokens';

import { formatUnits, lessUnits, wholeUnits, withoutGrouping } from '../units';

import { AllowanceCard, AmountField, InlineProblem, ProblemBanner, Section, type AmountInput } from './SetupParts';
import { useSetupPreferences } from './SetupPreferencesProvider';

export const DEFAULT_BUY_IN = '1000';
const MAX_BUY_IN_DIGITS = 13;

const PROBLEMS: Record<StartProblem, string> = {
  'invalid-buy-in': `Enter whole units from 1 to ${formatUnits(FUNDING_CEILING.toString())}.`,
  'strategy-incompatible': "This strategy doesn't fit your table.",
  'save-failed': "The session couldn't be saved, so it hasn't started. Try again.",
  'access-denied': "This session can't start right now.",
  'access-uncertain': `${RECONNECT_TO_VERIFY}. Nothing has started and nothing was used.`,
};

export type Opening =
  | { readonly kind: 'strategy'; readonly amount: string; readonly strategyName: string; readonly bets: string }
  | { readonly kind: 'table'; readonly amount: string };

const wholeDigits = (digits: string) => /^\d+$/.test(digits) && digits.length <= MAX_BUY_IN_DIGITS;

export function useFunding(game: GameId, opening: Opening | null) {
  const { controller } = usePractice();
  const feedback = useFeedback();
  const { preferences, buyIns } = useSetupPreferences();
  const remembered = buyIns[game];
  const terms: SetupTerms = useLoaded((practice, id) => practice.setupTerms(id), controller, game) ?? PRACTICE_FUNDING_TERMS;
  const [draft, setDraft] = useState<string | null>(null);
  const [notWhole, setNotWhole] = useState(false);
  const input = useRef<AmountInput | null>(null);

  const text = draft ?? formatUnits(remembered ?? DEFAULT_BUY_IN);
  const training = terms.funding.source === 'training-bankroll' ? terms.funding : null;
  const digits = withoutGrouping(text);
  const funds = training ? training.available : wholeDigits(digits) && wholeUnits(digits) !== '0' ? wholeUnits(digits) : null;
  const short = opening !== null && funds !== null && lessUnits(funds, opening.amount);

  const change = (next: string) => {
    setDraft(next);
    setNotWhole(false);
  };

  const start = async (begin: (funds: { buyIn: string; fundingSource: FundingSource }) => Promise<void>): Promise<void> => {
    if (training) return begin({ buyIn: training.available, fundingSource: 'training-bankroll' });
    const ok = wholeDigits(digits);
    setNotWhole(!ok);
    if (!ok) return feedback.cue('input-rejected');
    const buyIn = wholeUnits(digits);
    await begin({ buyIn, fundingSource: 'practice-funding' });
    if (controller.snapshot().status === 'active') await preferences.rememberBuyIn(game, buyIn);
  };

  return { terms, training, text, change, notWhole, short, start, input, remembered: remembered !== undefined && draft === null, game };
}

export type FundingState = ReturnType<typeof useFunding>;

export function FundingSection({
  funding,
  opening,
  problem,
  problemReason,
}: {
  funding: FundingState;
  opening: Opening | null;
  problem: StartProblem | null;
  problemReason: string | null;
}) {
  const { terms, training, text, change, notWhole, short, input } = funding;
  const error = notWhole || problem === 'invalid-buy-in' ? PROBLEMS['invalid-buy-in'] : null;
  const refused = problem && problem !== 'invalid-buy-in' ? (problem === 'access-denied' && problemReason ? problemReason : PROBLEMS[problem]) : null;
  const inline = short && opening ? (opening.kind === 'strategy' ? `Too low for your strategy's opening bets (${formatUnits(opening.amount)}).` : `Too low for the table's smallest bet (${formatUnits(opening.amount)}).`) : null;

  return (
    <View style={styles.funding}>
      {training ? (
        <Section label="Funding">
          <AllowanceCard
            title={terms.allowance?.title ?? 'Training bankroll'}
            text={terms.allowance?.text ?? `${formatUnits(training.available)} training units available.`}
            detail="Your whole training bankroll funds this session, so there's no buy-in and no rebuys. What's left when the session ends goes back to today's training bankroll."
          />
          {inline && <InlineProblem>{inline}</InlineProblem>}
        </Section>
      ) : (
        <Section label="Buy-in">
          <AmountField
            ref={input}
            label="Starting chips for this session"
            accessibilityLabel="Starting chips for this session, in units"
            value={text}
            onChange={change}
            problem={error ?? inline}
            help={funding.remembered ? `Your last ${funding.game} buy-in. Each session starts fresh.` : 'Each session starts fresh.'}
          />
        </Section>
      )}
      {!training && terms.allowance && <AllowanceCard title={terms.allowance.title} text={terms.allowance.text} />}
      {refused && <InlineProblem alert>{refused}</InlineProblem>}
      {short && opening && <Shortfall opening={opening} training={training !== null} onRaise={() => change(formatUnits(opening.amount))} />}
    </View>
  );
}

function Shortfall({ opening, training, onRaise }: { opening: Opening; training: boolean; onRaise: () => void }) {
  const funds = training ? 'training bankroll' : 'buy-in';
  const amount = formatUnits(opening.amount);
  const title = opening.kind === 'strategy' ? `Your ${funds} can't cover the opening bets` : `Your ${funds} can't cover a bet at this table`;
  const body =
    opening.kind === 'strategy'
      ? `${opening.strategyName} opens with ${opening.bets}, which is ${amount} in total. ${training ? 'Pick a strategy with a smaller opening bet, or lower the table minimums.' : `Raise the buy-in to at least ${amount}, or pick a strategy with a smaller opening bet.`}`
      : `The smallest bet this table takes is ${amount}. ${training ? 'Lower the table minimums to play with what you have.' : `Raise the buy-in to at least ${amount}, or lower the table minimums.`}`;
  return (
    <ProblemBanner title={title} items={[{ text: body }]} testID="setup-shortfall">
      {!training && <Button label={`Set buy-in to ${amount}`} variant="secondary" stretch onPress={onRaise} />}
    </ProblemBanner>
  );
}

const styles = StyleSheet.create({ funding: { gap: space[4] } });
