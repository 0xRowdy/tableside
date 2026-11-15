// S2-13 Sign in with Apple / Google — no account for this identity. Sign in
// never creates one: this says so, and Create an account runs the age step,
// then creates the account for this same identity.

import type { IdentityProvider } from '@tableside/account';
import { router, useLocalSearchParams } from 'expo-router';
import { Apple, Aperture as Google, Mail, UserPlus } from 'lucide-react-native';
// The frames draw Google with lucide's old Chrome glyph, which lucide 1.x removed; Aperture is its nearest shape.
import { useState } from 'react';

import { FirstRunScreen, Footnote, InlineMessage, MethodButton } from '@/account/FirstRunParts';
import { PROVIDER_NAME, useProviderSignIn, useSignInFlow } from '@/account/sign-in-flow';

/** What each provider calls the player's identity there. */
const IDENTITY: Record<IdentityProvider, string> = { apple: 'Apple ID', google: 'Google account' };

export default function NoAccount() {
  const flow = useSignInFlow();
  const { provider: param } = useLocalSearchParams<{ provider?: string }>();
  const provider: IdentityProvider = param === 'google' ? 'google' : 'apple';
  const other: IdentityProvider = provider === 'apple' ? 'google' : 'apple';
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const signIn = useProviderSignIn(setProblem);

  return (
    <FirstRunScreen
      title={`No account for this ${IDENTITY[provider]}`}
      bar={{ title: 'Sign in', detail: 'I have an account' }}
      back={() => router.back()}
      intro={`We couldn't find a Tableside account for this ${IDENTITY[provider]}, and we haven't created one. Create one now? You'll answer an age question first.`}
    >
      <MethodButton label="Create an account" icon={UserPlus} disabled={busy} onPress={() => flow.createWith(provider)} />
      <MethodButton
        label={`Sign in with ${PROVIDER_NAME[other]} instead`}
        icon={other === 'apple' ? Apple : Google}
        disabled={busy}
        onPress={async () => {
          setBusy(true);
          await signIn(other);
          setBusy(false);
        }}
      />
      <MethodButton label="Sign in with an email code" icon={Mail} disabled={busy} onPress={flow.startSignIn} />
      <MethodButton label="Back to welcome" variant="ghost" disabled={busy} onPress={() => router.dismissTo('/welcome')} />
      {problem !== null && <InlineMessage>{problem}</InlineMessage>}
      <Footnote>Nothing about you is stored unless you create the account.</Footnote>
    </FirstRunScreen>
  );
}
