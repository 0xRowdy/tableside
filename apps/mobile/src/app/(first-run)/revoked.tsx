// S2-23 Locked — this device was signed out: the server confirmed this
// installation's session was revoked (from another device, or by the
// provider). The account's records stay on this device, closed and locked;
// a fresh sign-in to the same account opens them. No tab bar, so the support
// and privacy links are here (spec 2 Amendment 9 §1).
// TODO(frames): where "I didn't do this" leads, and the copy when a sign-in method's provider (Apple, Google) withdrew it, are unverified against S2-23, which draws only the other-device case; it opens Contact support.

import { Redirect } from 'expo-router';
import { LogIn, Smartphone } from 'lucide-react-native';
import { Linking, StyleSheet, View } from 'react-native';

import { dayText, deviceName } from '@/account/account-text';
import { useAccount } from '@/account/AccountProvider';
import { Actions, Body, FirstRunScreen, SupportLinks } from '@/account/FirstRunParts';
import { useSignInFlow } from '@/account/sign-in-flow';
import { WEB_PAGES } from '@/account/web-pages';
import { Button } from '@/components/Button';
import { palette, radius } from '@/theme/tokens';

export default function Revoked() {
  const { gate } = useAccount();
  const flow = useSignInFlow();
  if (gate.state !== 'revoked') return <Redirect href="/" />;
  const device = deviceName();
  return (
    <FirstRunScreen title={`This ${device} was signed out`} lead={<RevokedIcon />}>
      <Body>
        {gate.by === 'provider'
          ? `Your account was signed out on this ${device} on ${dayText(gate.revokedAt)}, when the Apple or Google sign-in it used stopped working with Tableside. Your records here are kept. Sign in to the same account to open them.`
          : `Your account was signed out on this ${device} from another device on ${dayText(gate.revokedAt)}. Your records here are kept. Sign in to the same account to open them.`}
      </Body>
      <Actions>
        <Button label="Sign in" icon={LogIn} stretch onPress={flow.startSignIn} />
        <Button label="I didn't do this" variant="ghost" stretch onPress={() => void Linking.openURL(WEB_PAGES.contactSupport)} />
      </Actions>
      <SupportLinks />
    </FirstRunScreen>
  );
}

function RevokedIcon() {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.icon}>
      <Smartphone color={palette.warning} size={30} />
    </View>
  );
}

const styles = StyleSheet.create({
  icon: { width: 64, height: 64, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.secondary },
});
