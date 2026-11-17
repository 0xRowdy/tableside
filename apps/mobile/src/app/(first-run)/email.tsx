// TODO(spec 2 S2-13–S2-14)

import { router } from 'expo-router';
import { useState } from 'react';

import { Actions, Field, FirstRunScreen, InlineMessage, LinkButton } from '@/account/FirstRunParts';
import { useCodeRequest, useSignInFlow } from '@/account/sign-in-flow';
import { Button } from '@/components/Button';

export default function Email() {
  const flow = useSignInFlow();
  const [email, setEmail] = useState(flow.email);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const create = flow.intent === 'create';
  const requestCode = useCodeRequest(setProblem);

  const send = async () => {
    const address = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setProblem('Enter an email address, like name@example.com.');
      return;
    }
    setBusy(true);
    setProblem(null);
    flow.setEmail(address);
    const sent = await requestCode(address);
    setBusy(false);
    if (sent) router.push('/code');
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
      {/* #107 */}
      {!create && <LinkButton label="Signing in for app review?" onPress={() => router.push('/review-sign-in')} />}
    </FirstRunScreen>
  );
}
