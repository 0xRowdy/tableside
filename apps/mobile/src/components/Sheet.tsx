// A bottom sheet over a dimmed screen (the frames' Sheet Header: grabber,
// title, Close), as a modal the screen reader stays inside. At large text
// sizes it takes the whole screen, so nothing is cut off; its content scrolls.

import { X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import { fonts, MIN_TOUCH_TARGET, palette, radius, space, textScale } from '@/theme/tokens';

/** Above this text size the sheet takes the whole screen. */
const FULL_SCREEN_FONT_SCALE = 1.5;

export function Sheet({ title, onClose, testID, children }: { title: string; onClose: () => void; testID?: string; children: ReactNode }) {
  const { fontScale } = useWindowDimensions();
  const fullScreen = fontScale > FULL_SCREEN_FONT_SCALE;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
      <View style={[styles.scrim, fullScreen && styles.scrimFull]}>
        <View accessibilityViewIsModal style={[styles.sheet, fullScreen && styles.sheetFull]}>
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

/** Body text in a sheet. */
export function SheetText({ children, small = false }: { children: ReactNode; small?: boolean }) {
  return (
    <Text maxFontSizeMultiplier={textScale.body} style={small ? styles.note : styles.text}>
      {children}
    </Text>
  );
}

function CloseButton({ onPress }: { onPress: () => void }) {
  const { focused, focusProps } = useKeyboardFocus();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onPress} {...focusProps} style={[styles.close, focused && styles.focused]}>
      <X color={palette.foreground} size={20} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: palette.scrim },
  scrimFull: { justifyContent: 'flex-start' },
  sheet: { maxHeight: '90%', borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, backgroundColor: palette.popover },
  sheetFull: { flexGrow: 1, maxHeight: '100%', borderRadius: 0 },
  content: { gap: space[3] + 2, paddingHorizontal: space[6] - space[1], paddingBottom: space[4] },
  grabber: { alignSelf: 'center', width: 40, height: 5, marginTop: space[3], borderRadius: 3, backgroundColor: palette.controlBorder },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2] },
  title: { flex: 1, fontFamily: fonts.display, fontSize: 22, color: palette.foreground },
  text: { fontFamily: fonts.ui, fontSize: 14, lineHeight: 20, color: palette.mutedForeground },
  note: { fontFamily: fonts.ui, fontSize: 13, lineHeight: 19, color: palette.mutedForeground },
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
});
