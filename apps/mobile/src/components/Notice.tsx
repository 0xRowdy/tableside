import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { fonts, palette, radius, space, textScale } from '@/theme/tokens';
import { makeStyles } from '@/theme/type';

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
  const styles = useStyles();
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
  const styles = useStyles();
  return (
    <Text maxFontSizeMultiplier={textScale.body} style={styles.text}>
      {children}
    </Text>
  );
}

const useStyles = makeStyles((type) => ({
  notice: { gap: space[2], padding: space[4], borderRadius: radius.lg, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.primary },
  title: { fontFamily: fonts.uiSemiBold, ...type.body, color: palette.foreground },
  text: { fontFamily: fonts.ui, ...type.secondary, color: palette.mutedForeground },
}));
