import { Redirect, Stack } from 'expo-router';

import { isRestricted, opensOrdinaryAccess, useAccount } from '@/account/AccountProvider';
import { SignInFlowProvider } from '@/account/sign-in-flow';
import { palette } from '@/theme/tokens';

/**
 * The pre-account screens: welcome, age (Create only), email and code. They
 * have no tab bar. Once the account is signed in, the app moves on to the
 * offline game choice, then Home.
 */
export default function FirstRunLayout() {
  const { gate } = useAccount();
  if (opensOrdinaryAccess(gate) || isRestricted(gate)) return <Redirect href="/" />;
  return (
    <SignInFlowProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.background } }} />
    </SignInFlowProvider>
  );
}
