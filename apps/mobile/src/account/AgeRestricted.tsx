// The account gate's age states (S2-15 "unresolved, existing account paused"):
// ordinary access is closed and the tab bar hidden, the records are kept, and
// the restricted paths stay. Unresolved may retry the age check; when the
// platform proves nothing and a declaration may decide, the fallback question follows.
// TODO(frames): the under-13 variant (an existing account found under 13), the
// "can't be met" conflict line and the "still couldn't be confirmed" retry
// status have no frame; they reuse S2-15's unresolved layout and type.

import { useState } from 'react';

import { Button } from '@/components/Button';

import { useAccount, type AgeRestrictedGate } from './AccountProvider';
import { AgeQuestionScreen, CONNECTION_PROBLEM } from './AgeQuestion';
import { Actions, Body, FirstRunScreen, InlineMessage, SectionLabel, Status } from './FirstRunParts';
import { RestrictedPathRows } from './RestrictedPaths';

const PAUSED = { title: 'Account paused' } as const;

export function AgeRestricted({ gate }: { gate: AgeRestrictedGate }) {
  const { service } = useAccount();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  if (gate.state === 'age-ineligible') {
    return (
      <FirstRunScreen
        title="Tableside is for people 13 and older"
        context={PAUSED}
        intro="Practice and your account are paused. Your records are kept and nothing has been deleted. If this isn't right, contact support."
      >
        <SectionLabel>You can still</SectionLabel>
        <RestrictedPathRows />
      </FirstRunScreen>
    );
  }

  // An answer that leaves it unresolved (or ineligible) shows the gate's own screen again.
  const answered = () => setAsking(false);
  if (asking) return <AgeQuestionScreen context={PAUSED} back={() => setAsking(false)} onAnswered={answered} />;

  const retry = async () => {
    setBusy(true);
    setProblem(null);
    const result = await service.checkAge();
    setBusy(false);
    if (result.status === 'question') setAsking(true);
    else if (result.status === 'failed') setProblem(CONNECTION_PROBLEM);
    else if (result.status === 'unresolved') setProblem("Your age still couldn't be confirmed.");
  };

  return (
    <FirstRunScreen
      title="We couldn't confirm your age"
      context={PAUSED}
      intro="Practice and your account are paused until your age range can be confirmed. Your records are kept and nothing has been deleted."
    >
      {gate.reason === 'check-unmet' && <Body>{"Your device requires an age check that can't be completed here. Contact support if you need help."}</Body>}
      <SectionLabel>You can still</SectionLabel>
      <RestrictedPathRows />
      {problem === CONNECTION_PROBLEM ? <InlineMessage>{problem}</InlineMessage> : problem && <Status>{problem}</Status>}
      <Actions>
        <Button label="Try the age check again" variant="secondary" stretch disabled={busy} onPress={() => void retry()} />
      </Actions>
    </FirstRunScreen>
  );
}
