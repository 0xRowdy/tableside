// S2-15 Age — fallback question: a neutral age-range question, never a birth
// date or ID. The Create path's age step asks it when the platform can't share
// a range; an unresolved account's retry asks it when a declaration may decide.

import type { AgeAnswerResult, AgeRange } from '@tableside/account';
import { useState } from 'react';

import { Button } from '@/components/Button';

import { useAccount } from './AccountProvider';
import { Actions, Body, ChoiceGroup, ChoiceRow, FirstRunScreen, InlineMessage } from './FirstRunParts';

const RANGES: readonly { range: AgeRange; label: string }[] = [
  { range: 'under-13', label: 'Under 13' },
  { range: '13-15', label: '13 to 15' },
  { range: '16-17', label: '16 to 17' },
  { range: '18+', label: '18 or older' },
];

export const AGE_QUESTION = 'How old are you?';
export const AGE_STEP = { title: 'Before you start', detail: 'Step 1 of 2 · age' } as const;
export const CONNECTION_PROBLEM = "Couldn't continue. Check your connection and try again.";

export function AgeQuestionScreen({
  bar = AGE_STEP,
  back,
  onAnswered,
  problem = null,
  working = false,
}: {
  bar?: { readonly title: string; readonly detail?: string };
  back?: () => void;
  /** The answer's outcome; a failure is shown here. */
  onAnswered: (result: Exclude<AgeAnswerResult, { status: 'failed' }>) => void | Promise<void>;
  /** A problem with what the answer led to (creating the account with Apple or Google), shown under the question. */
  problem?: string | null;
  /** What the answer led to is still under way. */
  working?: boolean;
}) {
  const { service } = useAccount();
  const [range, setRange] = useState<AgeRange | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const answer = async () => {
    if (!range) return;
    setBusy(true);
    setFailed(false);
    const result = await service.answerAgeQuestion(range);
    if (result.status === 'failed') setFailed(true);
    else await onAnswered(result);
    setBusy(false);
  };

  return (
    <FirstRunScreen
      title={AGE_QUESTION}
      bar={bar}
      intro="Choose a range. We keep only the range, never a birth date, and don't use it for ads or show it to anyone."
      back={back}
    >
      <ChoiceGroup label={AGE_QUESTION} testID="age-question">
        {RANGES.map((option) => (
          <ChoiceRow key={option.range} label={option.label} selected={range === option.range} onPress={() => setRange(option.range)} />
        ))}
      </ChoiceGroup>
      {failed && <InlineMessage>{CONNECTION_PROBLEM}</InlineMessage>}
      {problem !== null && <InlineMessage>{problem}</InlineMessage>}
      <Actions>
        <Button label="Continue" stretch disabled={!range || busy || working} onPress={() => void answer()} />
        {!range && <Body>Continue is available once you choose a range.</Body>}
      </Actions>
    </FirstRunScreen>
  );
}
