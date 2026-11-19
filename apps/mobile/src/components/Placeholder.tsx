import type { ReactNode } from 'react';
import { Text } from 'react-native';

import { Screen } from './Screen';
import { fonts, palette, textScale } from '@/theme/tokens';
import { makeStyles } from '@/theme/type';

export function Placeholder({ title, message, children }: { title: string; message: string; children?: ReactNode }) {
  const styles = useStyles();
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

const useStyles = makeStyles((type) => ({
  title: { fontFamily: fonts.display, ...type.display, color: palette.foreground },
  message: { fontFamily: fonts.ui, ...type.body, color: palette.mutedForeground },
}));
