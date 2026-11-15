// S2-13 Welcome: "I'm new here" and "I have an account" are separate paths,
// and the screen says why a connection is needed. Sign in offers Apple,
// Google and an email code, and never asks for age; I'm new continues to the
// age step, then the sign-in method.
// TODO(frames): S2-13's hero image (Tableside-assets/generated-5.png) isn't in the app's assets yet, so the brand block has no image.

import { Apple, ArrowRight, Aperture as Google, Mail, Wifi } from 'lucide-react-native';
// The frames draw Google with lucide's old Chrome glyph, which lucide 1.x removed; Aperture is its nearest shape.
import { useState } from 'react';

import { Body, Footnote, FirstRunScreen, InlineMessage, IntentSwitch, MethodButton } from '@/account/FirstRunParts';
import { useProviderSignIn, useSignInFlow } from '@/account/sign-in-flow';

type Intent = 'new' | 'existing';

const INTENTS: readonly { value: Intent; label: string }[] = [
  { value: 'new', label: "I'm new here" },
  { value: 'existing', label: 'I have an account' },
];

export default function Welcome() {
  const flow = useSignInFlow();
  const [intent, setIntent] = useState<Intent>('existing');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const signIn = useProviderSignIn(setProblem);

  const withProvider = async (provider: 'apple' | 'google') => {
    setBusy(true);
    await signIn(provider);
    setBusy(false);
  };

  return (
    <FirstRunScreen title="Tableside" intro="Practice blackjack, craps and roulette with a coach that explains every decision.">
      <IntentSwitch
        label="Do you have an account?"
        options={INTENTS}
        value={intent}
        onChange={(next) => {
          setIntent(next);
          setProblem(null);
        }}
      />
      {intent === 'existing' ? (
        <>
          <Body>Sign in to get your history, strategies and purchases back.</Body>
          <MethodButton label="Sign in with Apple" icon={Apple} disabled={busy} onPress={() => void withProvider('apple')} />
          <MethodButton label="Sign in with Google" icon={Google} disabled={busy} onPress={() => void withProvider('google')} />
          <MethodButton label="Sign in with an email code" icon={Mail} disabled={busy} onPress={flow.startSignIn} />
          {problem !== null && <InlineMessage>{problem}</InlineMessage>}
          <Footnote icon={Wifi}>Signing in needs a connection the first time and after you sign out. After that, practice works offline.</Footnote>
        </>
      ) : (
        <>
          <Body>
            Create a free account. It keeps your sessions safe and lets you use more than one device. First, a quick age check, then you choose how to sign in.
          </Body>
          <MethodButton label="Continue" icon={ArrowRight} variant="primary" onPress={flow.startCreate} />
          <Footnote icon={Wifi}>Creating an account needs a connection. After that, practice works offline.</Footnote>
        </>
      )}
    </FirstRunScreen>
  );
}
