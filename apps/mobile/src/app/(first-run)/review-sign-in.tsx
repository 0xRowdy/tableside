// App review sign-in (#107; spec 2 *App-review access*): app reviewers sign in
// to a reviewer account with the address and reviewer credential from the
// review notes, without an email code. It works for reviewer accounts only;
// every other address is refused in the same words.
// TODO(frames): no frame for this screen; it follows the email step's layout.

import { router } from 'expo-router';
import { useState } from 'react';

import { useAccount } from '@/account/AccountProvider';
import { Actions, Field, FirstRunScreen, InlineMessage } from '@/account/FirstRunParts';
import { Button } from '@/components/Button';

export default function ReviewSignIn() {
  const { service } = useAccount();
  const [email, setEmail] = useState('');
  const [credential, setCredential] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const signIn = async () => {
    const address = email.trim();
    if (!address || !credential.trim()) {
      setProblem('Enter the email address and reviewer credential from the review notes.');
      return;
    }
    setBusy(true);
    setProblem(null);
    const result = await service.signInAsReviewer({ email: address, credential });
    setBusy(false);
    // Signed in: the layout moves on as the account gate changes.
    if (result.status === 'refused') setProblem("That address and reviewer credential don't match. Check both and try again.");
    else if (result.status === 'failed') setProblem("Couldn't sign in. Check your connection and try again.");
  };

  return (
    <FirstRunScreen
      title="App review sign-in"
      intro="For app store reviewers: use the address and reviewer credential from the review notes."
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
        returnKeyType="next"
      />
      <Field
        label="Reviewer credential"
        value={credential}
        onChangeText={setCredential}
        problem={problem !== null}
        secureTextEntry
        autoCapitalize="characters"
        autoComplete="off"
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={() => void signIn()}
      />
      {problem !== null && <InlineMessage>{problem}</InlineMessage>}
      <Actions>
        <Button label="Sign in" stretch disabled={busy} onPress={() => void signIn()} />
      </Actions>
    </FirstRunScreen>
  );
}
