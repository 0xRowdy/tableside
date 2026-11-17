import { Redirect, Stack } from 'expo-router';

import { isRestricted, opensOrdinaryAccess, useAccount } from '@/account/AccountProvider';
import { SignInFlowProvider } from '@/account/sign-in-flow';
import { palette } from '@/theme/tokens';

export default function FirstRunLayout() {
  const { gate } = useAccount();
  if (opensOrdinaryAccess(gate) || isRestricted(gate)) return <Redirect href="/" />;
  return (
    <SignInFlowProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.background } }} />
    </SignInFlowProvider>
  );
}
