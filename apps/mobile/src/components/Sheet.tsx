import { X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import { fonts, MIN_TOUCH_TARGET, palette, radius, space, textScale } from '@/theme/tokens';
import { makeStyles } from '@/theme/type';

const FULL_SCREEN_FONT_SCALE = 1.5;

export function Sheet({ title, onClose, testID, children }: { title: string; onClose: () => void; testID?: string; children: ReactNode }) {
  const styles = useStyles();
  const { fontScale } = useWindowDimensions();
  const fullScreen = fontScale > FULL_SCREEN_FONT_SCALE;
  const insets = useSafeAreaInsets();
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
      <View style={[styles.scrim, fullScreen && styles.scrimFull]}>
        <View accessibilityViewIsModal style={[styles.sheet, fullScreen && styles.sheetFull, fullScreen && { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <ScrollView testID={testID} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.grabber} />
            <View style={styles.header}>
              <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.display} style={styles.title}>
                {title}
              </Text>
              <CloseButton onPress={onClose} />
            </View>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export function SheetText({ children, small = false }: { children: ReactNode; small?: boolean }) {
  const styles = useStyles();
  return (
    <Text maxFontSizeMultiplier={textScale.body} style={small ? styles.note : styles.text}>
      {children}
    </Text>
  );
}

function CloseButton({ onPress }: { onPress: () => void }) {
  const styles = useStyles();
  const { focused, focusProps } = useKeyboardFocus();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onPress} {...focusProps} style={[styles.close, focused && styles.focused]}>
      <X color={palette.foreground} size={20} />
    </Pressable>
  );
}

const useStyles = makeStyles((type) => ({
  scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: palette.scrim },
  scrimFull: { justifyContent: 'flex-start' },
  sheet: { maxHeight: '90%', borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, backgroundColor: palette.popover },
  sheetFull: { flexGrow: 1, maxHeight: '100%', borderRadius: 0 },
  content: { gap: space[3] + 2, paddingHorizontal: space[6] - space[1], paddingBottom: space[4] },
  grabber: { alignSelf: 'center', width: 40, height: 5, marginTop: space[3], borderRadius: 3, backgroundColor: palette.controlBorder },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2] },
  title: { flex: 1, fontFamily: fonts.display, ...type.headline, color: palette.foreground },
  text: { fontFamily: fonts.ui, ...type.secondary, color: palette.mutedForeground },
  note: { fontFamily: fonts.ui, ...type.secondary, color: palette.mutedForeground },
  close: {
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: palette.transparent,
    backgroundColor: palette.secondary,
  },
  focused: { borderColor: palette.ring },
}));
