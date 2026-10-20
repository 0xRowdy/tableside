import type { ReactNode } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Screen } from './Screen';
import { fonts, palette, textScale } from '@/theme/tokens';

/** Stands in for a destination that a later part of the app builds. */
export function Placeholder({ title, message, children }: { title: string; message: string; children?: ReactNode }) {
  return (
    <Screen>
      <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.display} style={styles.title}>
        {title}
      </Text>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.message}>{message}</Text>
      {children}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.display, fontSize: 30, color: palette.foreground },
  message: { fontFamily: fonts.ui, fontSize: 16, lineHeight: 24, color: palette.mutedForeground },
});
