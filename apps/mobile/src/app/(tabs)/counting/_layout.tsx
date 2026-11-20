// docs/decisions/lessons-entry-points.md (routes)
import { Stack } from 'expo-router';

import { palette } from '@/theme/tokens';

export const unstable_settings = { anchor: 'index' };

export default function CountingLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.background } }} />;
}
