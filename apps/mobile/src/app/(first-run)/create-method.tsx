// S2-13 Create account — choose a method, after the age step: Apple, Google
// or an email code. It says plainly that this makes a new, empty account, so
// it never reads as getting another account back.

import { router } from 'expo-router';
import { Apple, Aperture as Google, Mail } from 'lucide-react-native';
// The frames draw Google with lucide's old Chrome glyph, which lucide 1.x removed; Aperture is its nearest shape.
import { useState } from 'react';

import { FirstRunScreen, Footnote, InlineMessage, MethodButton } from '@/account/FirstRunParts';
import { useProviderCreate } from '@/account/sign-in-flow';

export default function CreateMethod() {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const create = useProviderCreate(setProblem);

  const withProvider = async (provider: 'apple' | 'google') => {
    setBusy(true);
    await create(provider);
    setBusy(false);
  };

  return (
    <FirstRunScreen
      title="How do you want to sign in?"
      bar={{ title: 'Create your account', detail: 'Step 2 of 2' }}
      back={() => router.back()}
      intro="This creates a new, empty Tableside account. If you already have one, sign in instead so your history comes back."
    >
      <MethodButton label="Continue with Apple" icon={Apple} disabled={busy} onPress={() => void withProvider('apple')} />
      <MethodButton label="Continue with Google" icon={Google} disabled={busy} onPress={() => void withProvider('google')} />
      <MethodButton label="Create with an email code" icon={Mail} disabled={busy} onPress={() => router.push('/email')} />
      <MethodButton label="I already have an account" variant="ghost" disabled={busy} onPress={() => router.dismissTo('/welcome')} />
      {problem !== null && <InlineMessage>{problem}</InlineMessage>}
      <Footnote>No password. You can add another sign-in method later in Account.</Footnote>
    </FirstRunScreen>
  );
}
