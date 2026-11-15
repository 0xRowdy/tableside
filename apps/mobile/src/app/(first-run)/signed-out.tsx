// S2-23 Locked — signed out: after Sign out of this device, the account's
// records stay on this device, closed and locked. Only an online sign-in to
// the same account opens them; another account sees none of them. No tab bar,
// so the support and privacy links are here (spec 2 Amendment 9 §1).

import { Redirect, router } from 'expo-router';
import { LogIn, LogOut } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { thisDevice } from '@/account/account-text';
import { useAccount } from '@/account/AccountProvider';
import { Actions, Body, FirstRunScreen, SupportLinks } from '@/account/FirstRunParts';
import { useSignInFlow } from '@/account/sign-in-flow';
import { Button } from '@/components/Button';
import { fonts, palette, radius, textScale } from '@/theme/tokens';

export default function SignedOut() {
  const { gate } = useAccount();
  const flow = useSignInFlow();
  if (gate.state !== 'signed-out') return <Redirect href="/" />;
  return (
    <FirstRunScreen title="You're signed out" lead={<SignedOutIcon />}>
      <Body>
        Your records for this account are kept on this {thisDevice()}, locked. Sign in to the same account to open them. Signing in needs a
        connection.
      </Body>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.note}>
        Someone signing in with a different account won&apos;t see these records.
      </Text>
      <Actions>
        <Button label="Sign in" icon={LogIn} stretch onPress={flow.startSignIn} />
        <Button label="Use a different account" variant="ghost" stretch onPress={() => router.push('/welcome')} />
      </Actions>
      <SupportLinks />
    </FirstRunScreen>
  );
}

function SignedOutIcon() {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.icon}>
      <LogOut color={palette.mutedForeground} size={30} />
    </View>
  );
}

const styles = StyleSheet.create({
  icon: { width: 64, height: 64, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.secondary },
  note: { fontFamily: fonts.ui, fontSize: 13, lineHeight: 19, color: palette.mutedForeground },
});
