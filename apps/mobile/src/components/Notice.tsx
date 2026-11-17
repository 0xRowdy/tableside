import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { fonts, palette, radius, space, textScale } from '@/theme/tokens';

export function Notice({
  title,
  role = 'header',
  children,
  testID,
}: {
  title: string;
  role?: 'header' | 'alert';
  children?: ReactNode;
  testID?: string;
}) {
  return (
    <View style={styles.notice} testID={testID}>
      <Text accessibilityRole={role} maxFontSizeMultiplier={textScale.body} style={styles.title}>
        {title}
      </Text>
      {children}
    </View>
  );
}

export function NoticeText({ children }: { children: ReactNode }) {
  return (
    <Text maxFontSizeMultiplier={textScale.body} style={styles.text}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  notice: { gap: space[2], padding: space[4], borderRadius: radius.lg, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.primary },
  title: { fontFamily: fonts.uiBold, fontSize: 14, color: palette.foreground },
  text: { fontFamily: fonts.ui, fontSize: 13, color: palette.mutedForeground },
});
