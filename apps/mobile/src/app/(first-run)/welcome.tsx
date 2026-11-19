// Spec 2 S2-13

import type { CodeIntent } from '@tableside/account';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight, Mail, Wifi } from 'lucide-react-native';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Footnote, FirstRunScreen, InlineMessage, IntentSwitch, MethodButton } from '@/account/FirstRunParts';
import { PROVIDERS } from '@/account/providers';
import { useProviderSignIn, useSignInFlow } from '@/account/sign-in-flow';
import { findGame } from '@/games';
import { palette, radius } from '@/theme/tokens';
import { useTextSize } from '@/theme/type';

const INTENTS: readonly { value: CodeIntent; label: string }[] = [
  { value: 'create', label: "I'm new here" },
  { value: 'sign-in', label: 'I have an account' },
];

const HERO = findGame('blackjack')!.image;

export default function Welcome() {
  const flow = useSignInFlow();
  const [intent, setIntent] = useState<CodeIntent>('sign-in');
  const signIn = useProviderSignIn();
  const { chosen } = useTextSize();

  // Spec 2 Amendment 10 §2
  if (!chosen) return <Redirect href="/text-size" />;

  return (
    <FirstRunScreen
      title="Tableside"
      above={
        <View style={styles.hero} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Image source={HERO} style={StyleSheet.absoluteFill} contentFit="cover" />
          <LinearGradient colors={[palette.transparent, palette.scrim]} style={StyleSheet.absoluteFill} />
        </View>
      }
      intro="Practice blackjack, craps and roulette with a coach that explains every decision."
    >
      <IntentSwitch label="Do you have an account?" options={INTENTS} value={intent} onChange={setIntent} />
      {intent === 'sign-in' ? (
        <>
          <Body>Sign in to get your history, strategies and purchases back.</Body>
          {(['apple', 'google'] as const).map((provider) => (
            <MethodButton
              key={provider}
              label={`Sign in with ${PROVIDERS[provider].name}`}
              icon={PROVIDERS[provider].icon}
              disabled={signIn.busy}
              onPress={() => void signIn.run(provider)}
            />
          ))}
          <MethodButton label="Sign in with an email code" icon={Mail} disabled={signIn.busy} onPress={flow.startSignIn} />
          {signIn.problem !== null && <InlineMessage>{signIn.problem}</InlineMessage>}
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

const styles = StyleSheet.create({
  hero: { height: 140, borderRadius: radius.card, overflow: 'hidden', backgroundColor: palette.card },
});
