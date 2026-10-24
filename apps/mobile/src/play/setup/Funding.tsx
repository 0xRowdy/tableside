// Session funding at setup: a fresh buy-in (prefilled with the game's last
// one, a setup preference) or, under spec 5's bankroll policy, the whole
// training bankroll with no buy-in field (Amendment 4 §B). Opening bets the
// funds can't cover are explained before play, never shrunk or topped up.

import { FUNDING_CEILING, type FundingSource } from '@tableside/engine';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { useFeedback } from '@/feedback/FeedbackProvider';
import type { GameId } from '@/games';
import { PRACTICE_FUNDING_TERMS, type SetupTerms } from '@/practice/adapters';
import { RECONNECT_TO_VERIFY, type StartProblem } from '@/practice/controller';
import { usePractice } from '@/practice/PracticeProvider';
import { space } from '@/theme/tokens';

import { formatUnits, lessUnits, withoutGrouping } from '../units';

import { AllowanceCard, AmountField, InlineProblem, ProblemBanner, Section, type AmountInput } from './SetupParts';
import { useSetupPreferences } from './SetupPreferencesProvider';

export const DEFAULT_BUY_IN = '1000';
/** Longest buy-in text accepted before the engine judges the amount (the ceiling has 10 digits). */
const MAX_BUY_IN_DIGITS = 13;

const PROBLEMS: Record<StartProblem, string> = {
  'invalid-buy-in': `Enter whole units from 1 to ${formatUnits(FUNDING_CEILING.toString())}.`,
  'strategy-incompatible': "This strategy doesn't fit your table.",
  'save-failed': "The session couldn't be saved, so it hasn't started. Try again.",
  'access-denied': "This session can't start right now.",
  'access-uncertain': `${RECONNECT_TO_VERIFY}. Nothing has started and nothing was used.`,
};

/** What the opening of play needs, so a shortfall can be explained before it. */
export type Opening =
  /** Guided practice: the strategy's first bets. */
  | { readonly kind: 'strategy'; readonly amount: string; readonly strategyName: string; readonly bets: string }
  /** Free play: the table's smallest bet. */
  | { readonly kind: 'table'; readonly amount: string };

const wholeDigits = (digits: string) => /^\d+$/.test(digits) && digits.length <= MAX_BUY_IN_DIGITS;

export function useFunding(game: GameId, opening: Opening | null) {
  const { controller } = usePractice();
  const feedback = useFeedback();
  const { preferences, buyIns } = useSetupPreferences();
  const remembered = buyIns[game];
  const [terms, setTerms] = useState<SetupTerms>(PRACTICE_FUNDING_TERMS);
  const [draft, setDraft] = useState<string | null>(null);
  const [notWhole, setNotWhole] = useState(false);
  const input = useRef<AmountInput | null>(null);

  useEffect(() => {
    let current = true;
    void controller.setupTerms(game).then((next) => current && setTerms(next));
    return () => {
      current = false;
    };
  }, [controller, game]);

  // Until the player types, the field shows the remembered buy-in (which may load after the first render).
  const text = draft ?? formatUnits(remembered ?? DEFAULT_BUY_IN);
  const training = terms.funding.source === 'training-bankroll' ? terms.funding : null;
  const digits = withoutGrouping(text);
  // A buy-in that isn't positive whole units is explained at Start, not as a shortfall.
  const funds = training ? training.available : wholeDigits(digits) && BigInt(digits) > 0n ? BigInt(digits).toString() : null;
  const short = opening !== null && funds !== null && lessUnits(funds, opening.amount);

  const change = (next: string) => {
    setDraft(next);
    setNotWhole(false);
  };

  /**
   * Starts with this funding (the problem shown instead when the buy-in isn't
   * whole units). The buy-in is remembered only once a session has started.
   */
  const start = async (begin: (funds: { buyIn: string; fundingSource: FundingSource }) => Promise<void>): Promise<void> => {
    if (training) return begin({ buyIn: training.available, fundingSource: 'training-bankroll' });
    const ok = wholeDigits(digits);
    setNotWhole(!ok);
    if (!ok) return feedback.cue('input-rejected');
    const buyIn = BigInt(digits).toString();
    await begin({ buyIn, fundingSource: 'practice-funding' });
    if (controller.snapshot().status === 'active') await preferences.rememberBuyIn(game, buyIn);
  };

  return { terms, training, text, change, notWhole, short, start, input, remembered: remembered !== undefined && draft === null, game };
}

export type FundingState = ReturnType<typeof useFunding>;

/** The buy-in field (or the training bankroll that funds the session), the allowance line and any shortfall. */
export function FundingSection({
  funding,
  opening,
  problem,
  problemReason,
}: {
  funding: FundingState;
  opening: Opening | null;
  /** Why the controller refused the last start, if it did. */
  problem: StartProblem | null;
  /** The supervisor's own reason for a denied start. */
  problemReason: string | null;
}) {
  const { terms, training, text, change, notWhole, short, input } = funding;
  // A refused buy-in is explained at its field; any other refusal stands on its own.
  const error = notWhole || problem === 'invalid-buy-in' ? PROBLEMS['invalid-buy-in'] : null;
  const refused = problem && problem !== 'invalid-buy-in' ? (problem === 'access-denied' && problemReason ? problemReason : PROBLEMS[problem]) : null;
  const inline = short && opening ? (opening.kind === 'strategy' ? `Too low for your strategy's opening bets (${formatUnits(opening.amount)}).` : `Too low for the table's smallest bet (${formatUnits(opening.amount)}).`) : null;

  return (
    <View style={styles.funding}>
      {training ? (
        <Section label="FUNDING">
          <AllowanceCard
            title={terms.allowance?.title ?? 'TRAINING BANKROLL'}
            text={terms.allowance?.text ?? `${formatUnits(training.available)} training units available.`}
            detail="Your whole training bankroll funds this session, so there's no buy-in and no rebuys. What's left when the session ends goes back to today's training bankroll."
            seePremium={terms.seePremium}
          />
          {/* No field to sit under: the shortfall line stands alone. */}
          {inline && <InlineProblem>{inline}</InlineProblem>}
        </Section>
      ) : (
        <Section label="BUY-IN">
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
      {!training && terms.allowance && <AllowanceCard title={terms.allowance.title} text={terms.allowance.text} seePremium={terms.seePremium} />}
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
