// TODO(spec 2 S2-14)

import { INVALID_CODE } from '@tableside/account';
import { router } from 'expo-router';
import { useState } from 'react';

import { useAccount } from '@/account/AccountProvider';
import { Actions, Body, Field, FirstRunScreen, InlineMessage, LinkButton, Status } from '@/account/FirstRunParts';
import { useCodeRequest, useSignInFlow } from '@/account/sign-in-flow';
import { Button } from '@/components/Button';

export default function Code() {
  const { service } = useAccount();
  const flow = useSignInFlow();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const signIn = flow.intent === 'sign-in';
  const requestCode = useCodeRequest(setProblem);

  const verify = async () => {
    const entered = code.replace(/\s/g, '');
    if (!/^\d{6}$/.test(entered)) {
      setProblem('Enter the 6-digit code from the email.');
      return;
    }
    setBusy(true);
    setProblem(null);
    const result = await service.verifyEmailCode({ email: flow.email, code: entered });
    setBusy(false);
    if (result.status === 'invalid-code') setProblem(INVALID_CODE);
    else if (result.status === 'failed') setProblem("Couldn't sign in. Check your connection and try again.");
  };

  const resend = async () => {
    setBusy(true);
    setProblem(null);
    setResent(false);
    const sent = await requestCode(flow.email);
    setBusy(false);
    setResent(sent);
  };

  return (
    <FirstRunScreen
      title="Enter your code"
      intro={signIn ? "If an account exists for this address, we've sent a code." : "We've sent a code to confirm this address."}
      back={() => router.back()}
    >
      <Field
        label="Code"
        value={code}
        onChangeText={setCode}
        problem={problem !== null}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={6}
        returnKeyType="done"
        onSubmitEditing={() => void verify()}
      />
      {problem !== null && <InlineMessage>{problem}</InlineMessage>}
      {resent && <Status>{"We've sent a new code. Only the newest one works."}</Status>}
      <Actions>
        <Button label="Continue" stretch disabled={busy} onPress={() => void verify()} />
        <Button label="Send a new code" variant="secondary" stretch disabled={busy} onPress={() => void resend()} />
      </Actions>
      {signIn && (
        <>
          <Body>No code? Create an account, or use Apple or Google.</Body>
          <LinkButton
            label="Create an account"
            onPress={flow.startCreate}
          />
        </>
      )}
    </FirstRunScreen>
  );
}
