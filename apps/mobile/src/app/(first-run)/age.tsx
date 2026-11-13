// S2-15 Age step, on Create only: a neutral age-range question, never a birth
// date or ID. Under 13 ends the flow with nothing sent or kept.
// TODO(frames): unverified against S2-15 (Pencil couldn't open Tableside.pen for #88).

import type { AgeRange } from '@tableside/account';
import { router } from 'expo-router';
import { useState } from 'react';

import { useAccount } from '@/account/AccountProvider';
import { Actions, ChoiceGroup, ChoiceRow, FirstRunScreen, InlineMessage } from '@/account/FirstRunParts';
import { Button } from '@/components/Button';

const RANGES: readonly { range: AgeRange; label: string }[] = [
  { range: 'under-13', label: 'Under 13' },
  { range: '13-15', label: '13 to 15' },
  { range: '16-17', label: '16 to 17' },
  { range: '18+', label: '18 or older' },
];

const QUESTION = 'How old are you?';

export default function Age() {
  const { account } = useAccount();
  const [range, setRange] = useState<AgeRange | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const answer = async () => {
    if (!range) return;
    setBusy(true);
    setFailed(false);
    const result = await account.service.answerAgeQuestion(range);
    setBusy(false);
    if (result.status === 'ineligible') router.replace('/not-available');
    else if (result.status === 'eligible') router.push('/email');
    else setFailed(true);
  };

  return (
    <FirstRunScreen title={QUESTION} intro="Tableside is set up differently for some ages. We only ask for a range, never your birth date." back={() => router.back()}>
      <ChoiceGroup label={QUESTION} testID="age-question">
        {RANGES.map((option) => (
          <ChoiceRow key={option.range} label={option.label} selected={range === option.range} onPress={() => setRange(option.range)} />
        ))}
      </ChoiceGroup>
      {failed && <InlineMessage>{"Couldn't continue. Check your connection and try again."}</InlineMessage>}
      <Actions>
        <Button label="Continue" stretch disabled={!range || busy} onPress={() => void answer()} />
      </Actions>
    </FirstRunScreen>
  );
}
