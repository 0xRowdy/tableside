// Spec 2 S2-13

import type { IdentityProvider } from '@tableside/account';
import { router, useLocalSearchParams } from 'expo-router';
import { Mail, UserPlus } from 'lucide-react-native';

import { FirstRunScreen, Footnote, InlineMessage, MethodButton } from '@/account/FirstRunParts';
import { PROVIDERS } from '@/account/providers';
import { useProviderSignIn, useSignInFlow } from '@/account/sign-in-flow';

export default function NoAccount() {
  const flow = useSignInFlow();
  const { provider: param } = useLocalSearchParams<{ provider?: string }>();
  const provider: IdentityProvider = param === 'google' ? 'google' : 'apple';
  const other: IdentityProvider = provider === 'apple' ? 'google' : 'apple';
  const { identity } = PROVIDERS[provider];
  const signIn = useProviderSignIn();

  return (
    <FirstRunScreen
      title={`No account for this ${identity}`}
      bar={{ title: 'Sign in', detail: 'I have an account' }}
      back={() => router.back()}
      intro={`We couldn't find a Tableside account for this ${identity}, and we haven't created one. Create one now? You'll answer an age question first.`}
    >
      <MethodButton label="Create an account" icon={UserPlus} disabled={signIn.busy} onPress={() => flow.createWith(provider)} />
      <MethodButton
        label={`Sign in with ${PROVIDERS[other].name} instead`}
        icon={PROVIDERS[other].icon}
        disabled={signIn.busy}
        onPress={() => void signIn.run(other)}
      />
      <MethodButton label="Sign in with an email code" icon={Mail} disabled={signIn.busy} onPress={flow.startSignIn} />
      <MethodButton label="Back to welcome" variant="ghost" disabled={signIn.busy} onPress={() => router.dismissTo('/welcome')} />
      {signIn.problem !== null && <InlineMessage>{signIn.problem}</InlineMessage>}
      <Footnote>Nothing about you is stored unless you create the account.</Footnote>
    </FirstRunScreen>
  );
}
