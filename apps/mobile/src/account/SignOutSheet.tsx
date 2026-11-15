// S2-17 "Sign out of this device — unsynced records stay here": the sheet that
// confirms signing out of this device only. An open practice session saves and
// pauses, and unsynced records stay here, locked, for the same account.
// TODO(frames): the copy with nothing waiting to sync is unverified against S2-17, which draws only the waiting case.

import { LogOut, X } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Button } from '@/components/Button';
import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import { fonts, MIN_TOUCH_TARGET, palette, radius, space, textScale } from '@/theme/tokens';

import { useAccount } from './AccountProvider';
import { signOutText, thisDevice } from './account-text';

/** Above this text size the sheet takes the whole screen, so nothing is cut off. */
const FULL_SCREEN_FONT_SCALE = 1.5;

export function SignOutSheet({ waiting, onClose }: { waiting: number; onClose: () => void }) {
  const { service } = useAccount();
  const { fontScale } = useWindowDimensions();
  const fullScreen = fontScale > FULL_SCREEN_FONT_SCALE;
  const [signingOut, setSigningOut] = useState(false);
  const signOut = () => {
    setSigningOut(true);
    // The gate moves to Signed out, and the app leaves for the locked screen.
    void service.signOut();
  };
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
      <View style={[styles.scrim, fullScreen && styles.scrimFull]}>
        <View accessibilityViewIsModal style={[styles.sheet, fullScreen && styles.sheetFull]}>
          <ScrollView testID="sign-out-scroll" contentContainerStyle={styles.content}>
            <View style={styles.grabber} />
            <View style={styles.header}>
              <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.display} style={styles.title}>
                Sign out of this {thisDevice()}?
              </Text>
              <CloseButton onPress={onClose} />
            </View>
            <Text maxFontSizeMultiplier={textScale.body} style={styles.text}>
              {signOutText(waiting)}
            </Text>
            <Text maxFontSizeMultiplier={textScale.body} style={styles.note}>
              {waiting > 0 ? 'Export the local supplement first if you want a copy. Other devices stay signed in.' : 'Other devices stay signed in.'}
            </Text>
            <Button label="Sign out" icon={LogOut} stretch disabled={signingOut} onPress={signOut} />
            <Button label="Cancel" variant="ghost" stretch disabled={signingOut} onPress={onClose} />
          </ScrollView>
        </View>
      </View>
    </Modal>
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
