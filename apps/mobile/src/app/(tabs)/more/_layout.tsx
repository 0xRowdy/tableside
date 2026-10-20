import { Stack } from 'expo-router';

import { palette } from '@/theme/tokens';

/** More and the screens under it. Each screen draws its own header with Back; the tab bar stays. */
export default function MoreLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.background } }} />;
}
