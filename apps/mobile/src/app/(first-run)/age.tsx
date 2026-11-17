// Spec 2 S2-15

import type { AgeCheckResult } from '@tableside/account';
import { router } from 'expo-router';
import { useState } from 'react';

import { useAccount } from '@/account/AccountProvider';
import { AGE_STEP, AgeQuestionScreen, CONNECTION_PROBLEM } from '@/account/AgeQuestion';
import { Actions, Body, FirstRunScreen, InlineMessage } from '@/account/FirstRunParts';
import { useProviderCreate, useSignInFlow } from '@/account/sign-in-flow';
import { Button } from '@/components/Button';

export default function Age() {
  const { service } = useAccount();
  const flow = useSignInFlow();
  const create = useProviderCreate();
  const [asking, setAsking] = useState(!service.platformAgeCheck);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const onResult = async (result: Exclude<AgeCheckResult, { status: 'failed' }>) => {
    if (result.status === 'eligible') {
      if (flow.provider) await create.run(flow.provider);
      else router.push('/create-method');
    } else if (result.status === 'ineligible') router.replace('/not-available');
    else if (result.status === 'unresolved') router.replace('/age-unresolved');
    else setAsking(true);
  };

  if (asking) return <AgeQuestionScreen back={() => router.back()} onAnswered={onResult} problem={create.problem} working={create.busy} />;

  const check = async () => {
    setBusy(true);
    setFailed(false);
    const result = await service.checkAge();
    if (result.status === 'failed') setFailed(true);
    else await onResult(result);
    setBusy(false);
  };

  return (
    <FirstRunScreen
      title="First, your age range"
      bar={AGE_STEP}
      intro="Tableside is for people 13 and older. Your device can tell us your age range, so we never need a birth date or ID. We keep only the range."
      back={() => router.back()}
    >
      <Body>{"If your device can't share a range, or you'd rather not, we'll ask one question instead."}</Body>
      {failed && <InlineMessage>{CONNECTION_PROBLEM}</InlineMessage>}
      {create.problem !== null && <InlineMessage>{create.problem}</InlineMessage>}
      <Actions>
        <Button label="Continue" stretch disabled={busy || create.busy} onPress={() => void check()} />
      </Actions>
    </FirstRunScreen>
  );
}
