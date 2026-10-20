// Building blocks of the More and Settings screens (design frames "More",
// "Settings" and S1-12): the screen header with Back, list rows, the Sound
// effects slider and the Haptics switch row.

import { Check, ChevronLeft, ChevronRight, Volume1, Volume2, type LucideIcon } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import { fonts, MIN_TOUCH_TARGET, palette, radius, space, textScale } from '@/theme/tokens';

/** A settings screen: header, then content that reflows and scrolls at any text size. */
export function SettingsScreen({ title, back, children }: { title: string; back?: { label: string; onPress: () => void }; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      testID="settings-scroll"
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right, paddingBottom: space[6] }}
    >
      <View style={[styles.header, !back && styles.headerTopLevel]}>
        {back && <BackButton label={back.label} onPress={back.onPress} />}
        <View style={styles.titles}>
          <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.display} style={back ? styles.title : styles.topTitle}>
            {title}
          </Text>
          {back && (
            <Text maxFontSizeMultiplier={textScale.body} style={styles.parent}>
              {back.label}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.body}>{children}</View>
    </ScrollView>
  );
}

function BackButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { focused, focusProps } = useKeyboardFocus();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Back to ${label}`}
      onPress={onPress}
      {...focusProps}
      style={[styles.back, focused && styles.focused]}
    >
      <ChevronLeft color={palette.foreground} size={24} />
    </Pressable>
  );
}

/** A card holding rows or controls. */
export function Group({ children }: { children: ReactNode }) {
  return <View style={styles.group}>{children}</View>;
}

export function ListRow({ icon: Icon, title, detail, onPress }: { icon: LucideIcon; title: string; detail: string; onPress: () => void }) {
  const { focused, focusProps } = useKeyboardFocus();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${detail}`}
      onPress={onPress}
      {...focusProps}
      style={({ pressed }) => [styles.row, pressed && styles.pressed, focused && styles.focused]}
    >
      <View style={styles.lead}>
        <Icon color={palette.foreground} size={18} />
      </View>
      <View style={styles.rowText}>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.rowTitle}>{title}</Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.rowDetail}>{detail}</Text>
      </View>
      <ChevronRight color={palette.mutedForeground} size={18} />
    </Pressable>
  );
}

export function Note({ children }: { children: string }) {
  return (
    <Text maxFontSizeMultiplier={textScale.body} style={styles.note}>
      {children}
    </Text>
  );
}

const STEP = 10;

/** A 0–100 volume slider where 0 is off: drag or tap the track, use the buttons, or the screen reader's adjust actions. */
export function VolumeSlider({ label, value, onChange, help }: { label: string; value: number; onChange: (value: number) => void; help: string }) {
  const [trackWidth, setTrackWidth] = useState(0);
  const { focused, focusProps } = useKeyboardFocus();
  const valueText = value === 0 ? 'Off' : `${value}%`;
  const step = (direction: 1 | -1) => onChange(Math.min(100, Math.max(0, value + direction * STEP)));
  const fromTouch = (event: GestureResponderEvent) => {
    if (trackWidth > 0) onChange(Math.round((Math.min(trackWidth, Math.max(0, event.nativeEvent.locationX)) / trackWidth) * 100));
  };
  return (
    <View style={styles.sliderBlock}>
      <View style={styles.sliderHead}>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.rowTitle}>{label}</Text>
        <Text maxFontSizeMultiplier={textScale.body} style={[styles.sliderValue, value === 0 && styles.muted]}>{valueText}</Text>
      </View>
      <View style={styles.sliderRow}>
        <StepButton icon={Volume1} label={`Lower ${label.toLowerCase()}`} disabled={value === 0} onPress={() => step(-1)} />
        <View
          testID="sound-track"
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={label}
          accessibilityValue={{ min: 0, max: 100, now: value, text: valueText }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(event) => step(event.nativeEvent.actionName === 'increment' ? 1 : -1)}
          focusable
          {...focusProps}
          onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={fromTouch}
          onResponderMove={fromTouch}
          // Keep a horizontal drag on the track rather than handing it to the scroll view.
          onResponderTerminationRequest={() => false}
          style={[styles.track, focused && styles.focused]}
        >
          <View style={styles.rail}>
            <View style={[styles.filled, { width: `${value}%` }]} />
          </View>
          <View style={[styles.thumb, { left: `${value}%` }]} />
        </View>
        <StepButton icon={Volume2} label={`Raise ${label.toLowerCase()}`} disabled={value === 100} onPress={() => step(1)} />
      </View>
      <Note>{help}</Note>
    </View>
  );
}

function StepButton({ icon: Icon, label, disabled, onPress }: { icon: LucideIcon; label: string; disabled: boolean; onPress: () => void }) {
  const { focused, focusProps } = useKeyboardFocus();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      {...focusProps}
      style={[styles.stepButton, disabled && styles.disabled, focused && styles.focused]}
    >
      <Icon color={palette.foreground} size={20} />
    </Pressable>
  );
}

/** A labelled on/off switch filling its row. On and off differ by knob position and a check mark, not only color. */
export function SwitchRow({ title, detail, value, onChange }: { title: string; detail: string; value: boolean; onChange: (value: boolean) => void }) {
  const { focused, focusProps } = useKeyboardFocus();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={title}
      accessibilityHint={detail}
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      {...focusProps}
      style={[styles.switchRow, focused && styles.focused]}
    >
      <View style={styles.rowText}>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.rowTitle}>{title}</Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.rowDetail}>{detail}</Text>
      </View>
      <View style={[styles.switch, value ? styles.switchOn : styles.switchOff]}>
        <View style={[styles.knob, value ? styles.knobOn : styles.knobOff]}>{value && <Check color={palette.primary} size={14} />}</View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: space[1], minHeight: 56, paddingLeft: space[1], paddingRight: space[2] },
  headerTopLevel: { paddingLeft: space[6] - space[1] },
  back: { width: MIN_TOUCH_TARGET, minHeight: MIN_TOUCH_TARGET, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 2, borderColor: palette.transparent },
  titles: { flex: 1, gap: 1, paddingVertical: space[1] },
  topTitle: { fontFamily: fonts.uiBold, fontSize: 22, color: palette.foreground },
  title: { fontFamily: fonts.uiBold, fontSize: 17, color: palette.foreground },
  parent: { fontFamily: fonts.ui, fontSize: 12, color: palette.mutedForeground },
  body: { gap: space[4], paddingTop: space[2], paddingHorizontal: space[6] - space[1] },
  group: { borderRadius: radius.lg, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.card, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 64, paddingVertical: space[3], paddingHorizontal: space[4], borderWidth: 2, borderColor: palette.transparent },
  pressed: { backgroundColor: palette.secondary },
  lead: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.secondary },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: fonts.uiBold, fontSize: 15, lineHeight: 21, color: palette.foreground },
  rowDetail: { fontFamily: fonts.ui, fontSize: 13, lineHeight: 18, color: palette.mutedForeground },
  note: { fontFamily: fonts.ui, fontSize: 13, lineHeight: 20, color: palette.mutedForeground },
  sliderBlock: { gap: space[3] - 2, padding: space[4] },
  sliderHead: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: space[2] },
  sliderValue: { fontFamily: fonts.uiBold, fontSize: 15, color: palette.foreground },
  muted: { color: palette.mutedForeground },
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  stepButton: {
    width: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: palette.controlBorder,
    backgroundColor: palette.secondary,
  },
  disabled: { opacity: 0.4 },
  track: { flex: 1, minHeight: MIN_TOUCH_TARGET, justifyContent: 'center', borderRadius: radius.md, borderWidth: 2, borderColor: palette.transparent, marginHorizontal: 14 },
  rail: { height: 6, borderRadius: 3, backgroundColor: palette.controlBorder, overflow: 'hidden' },
  filled: { height: 6, backgroundColor: palette.primary },
  thumb: { position: 'absolute', width: 28, height: 28, marginLeft: -14, borderRadius: 14, backgroundColor: palette.foreground },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space[4], minHeight: MIN_TOUCH_TARGET + 16, paddingVertical: space[3], paddingHorizontal: space[4], borderWidth: 2, borderColor: palette.transparent },
  switch: { width: 52, height: 32, borderRadius: 16, padding: 3, justifyContent: 'center' },
  switchOn: { backgroundColor: palette.primary, alignItems: 'flex-end' },
  switchOff: { backgroundColor: palette.muted, borderWidth: 1.5, borderColor: palette.controlBorder, alignItems: 'flex-start' },
  knob: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  knobOn: { backgroundColor: palette.primaryForeground },
  knobOff: { width: 23, height: 23, backgroundColor: palette.mutedForeground },
  focused: { borderColor: palette.ring },
});
