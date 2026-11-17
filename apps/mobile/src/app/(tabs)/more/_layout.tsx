import { Stack } from 'expo-router';

import { palette } from '@/theme/tokens';

export default function MoreLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.background } }} />;
}
