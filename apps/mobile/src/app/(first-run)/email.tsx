// The email step: where the code goes, for Sign in or Create.
// TODO(frames): unverified against S2-13/S2-14 (Pencil couldn't open Tableside.pen for #88).

import { router } from 'expo-router';
import { useState } from 'react';

import { useAccount } from '@/account/AccountProvider';
import { codeRequestProblem } from '@/account/code-request-text';
import { Actions, Field, FirstRunScreen, InlineMessage } from '@/account/FirstRunParts';
import { useSignInFlow } from '@/account/sign-in-flow';
import { Button } from '@/components/Button';

export default function Email() {
  const { account } = useAccount();
  const flow = useSignInFlow();
  const [email, setEmail] = useState(flow.email);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const create = flow.intent === 'create';

  const send = async () => {
    const address = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setProblem('Enter an email address, like name@example.com.');
      return;
    }
    setBusy(true);
    setProblem(null);
    flow.setEmail(address);
    const result = await account.service.requestEmailCode({ email: address, intent: flow.intent });
    setBusy(false);
    if (result.status === 'sent') router.push('/code');
    // The age answer has expired: ask again.
    else if (result.status === 'age-required') router.replace('/age');
    else setProblem(codeRequestProblem(result));
  };

  return (
    <FirstRunScreen
      title={create ? 'Create your account' : 'Sign in'}
      intro={create ? "We'll email you a code to confirm your address." : "We'll email you a code. No password needed."}
      back={() => router.back()}
    >
      <Field
        label="Email address"
        value={email}
        onChangeText={setEmail}
        problem={problem !== null}
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="send"
        onSubmitEditing={() => void send()}
      />
      {problem !== null && <InlineMessage>{problem}</InlineMessage>}
      <Actions>
        <Button label="Send code" stretch disabled={busy} onPress={() => void send()} />
      </Actions>
    </FirstRunScreen>
  );
}
