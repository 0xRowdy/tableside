import type { ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { palette, space } from '@/theme/tokens';

/** A tab screen's scrollable content area. Content reflows and scrolls rather than shrinking. */
export function Screen({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + space[2], paddingLeft: insets.left + space[6], paddingRight: insets.right + space[6] },
      ]}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: palette.background },
  content: { flexGrow: 1, gap: space[4], paddingBottom: space[8] },
});
