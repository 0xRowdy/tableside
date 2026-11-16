// S2-13 Create account — choose a method, after the age step: Apple, Google
// or an email code. It says plainly that this makes a new, empty account, so
// it never reads as getting another account back.

import { router } from 'expo-router';
import { Mail } from 'lucide-react-native';

import { FirstRunScreen, Footnote, InlineMessage, MethodButton } from '@/account/FirstRunParts';
import { PROVIDERS } from '@/account/providers';
import { useProviderCreate } from '@/account/sign-in-flow';

export default function CreateMethod() {
  const create = useProviderCreate();
  return (
    <FirstRunScreen
      title="How do you want to sign in?"
      bar={{ title: 'Create your account', detail: 'Step 2 of 2' }}
      back={() => router.back()}
      intro="This creates a new, empty Tableside account. If you already have one, sign in instead so your history comes back."
    >
      {(['apple', 'google'] as const).map((provider) => (
        <MethodButton
          key={provider}
          label={`Continue with ${PROVIDERS[provider].name}`}
          icon={PROVIDERS[provider].icon}
          disabled={create.busy}
          onPress={() => void create.run(provider)}
        />
      ))}
      <MethodButton label="Create with an email code" icon={Mail} disabled={create.busy} onPress={() => router.push('/email')} />
      <MethodButton label="I already have an account" variant="ghost" disabled={create.busy} onPress={() => router.dismissTo('/welcome')} />
      {create.problem !== null && <InlineMessage>{create.problem}</InlineMessage>}
      <Footnote>No password. You can add another sign-in method later in Account.</Footnote>
    </FirstRunScreen>
  );
}
