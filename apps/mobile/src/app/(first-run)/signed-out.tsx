// Spec 2 S2-23

import { Redirect, router } from 'expo-router';
import { LogIn, LogOut } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { deviceName } from '@/account/account-text';
import { useAccount } from '@/account/AccountProvider';
import { Actions, Body, FirstRunScreen, SupportLinks } from '@/account/FirstRunParts';
import { useSignInFlow } from '@/account/sign-in-flow';
import { Button } from '@/components/Button';
import { fonts, palette, radius, textScale } from '@/theme/tokens';
import { makeStyles } from '@/theme/type';

export default function SignedOut() {
  const styles = useStyles();
  const { gate } = useAccount();
  const flow = useSignInFlow();
  if (gate.state !== 'signed-out') return <Redirect href="/" />;
  return (
    <FirstRunScreen title="You're signed out" lead={<SignedOutIcon />}>
      <Body>
        Your records for this account are kept on this {deviceName()}, locked. Sign in to the same account to open them. Signing in needs a
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
  const styles = useStyles();
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.icon}>
      <LogOut color={palette.mutedForeground} size={30} />
    </View>
  );
}

const useStyles = makeStyles((type) => ({
  icon: { width: 64, height: 64, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.secondary },
  note: { fontFamily: fonts.ui, ...type.secondary, color: palette.mutedForeground },
}));
