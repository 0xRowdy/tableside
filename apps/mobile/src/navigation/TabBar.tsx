// The persistent six-tab bar. It stays one row at every text size: labels don't
// scale with system text, and the platform's large-content pattern shows an
// enlarged label instead — the iOS Large Content Viewer, or on Android a
// preview while a tab is held.
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { TabListProps, TabTriggerSlotProps } from 'expo-router/ui';
import { createContext, use, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { LargeContentContainer, LargeContentItem } from '../../modules/large-content-viewer';
import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import { fonts, MIN_TOUCH_TARGET, palette, radius, space } from '@/theme/tokens';
import type { TabDefinition } from './tabs';

/**
 * Android's largest font scale on the Android 10 floor; larger scales exist on
 * newer versions. Android stores it as a 32-bit float, so compare in float.
 */
const ANDROID_LARGE_CONTENT_FONT_SCALE = Math.fround(1.3);

const PreviewContext = createContext<{ preview: (tab: TabDefinition | null) => void }>({ preview: () => {} });

export function TabBar({ children, style, ...props }: TabListProps & { children?: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [previewed, setPreviewed] = useState<TabDefinition | null>(null);

  return (
    <PreviewContext value={{ preview: setPreviewed }}>
      <View {...props} testID="tab-bar" accessibilityRole="tablist" style={[style, styles.bar, { paddingBottom: insets.bottom }]}>
        <LargeContentContainer style={styles.items}>{children}</LargeContentContainer>
        {previewed && <LargeContentPreview tab={previewed} />}
      </View>
    </PreviewContext>
  );
}

// `ref` is dropped: TabTrigger's ref type doesn't match Pressable's, and nothing uses it.
export function TabButton({ tab, isFocused = false, ref: _ref, ...props }: TabTriggerSlotProps & { tab: TabDefinition }) {
  const { preview } = use(PreviewContext);
  const { fontScale } = useWindowDimensions();
  const { focused: keyboardFocused, focusProps } = useKeyboardFocus({ onFocus: props.onFocus, onBlur: props.onBlur });
  const previewOnHold = Platform.OS === 'android' && Math.fround(fontScale) >= ANDROID_LARGE_CONTENT_FONT_SCALE;
  const Icon = tab.icon;
  const tint = isFocused ? palette.primary : palette.mutedForeground;

  return (
    <LargeContentItem title={tab.label} systemImage={tab.systemImage} onSelect={() => selectWithoutEvent(props.onPress)} style={styles.item}>
      <Pressable
        {...props}
        accessibilityRole="tab"
        accessibilityLabel={tab.label}
        accessibilityState={{ selected: isFocused }}
        onLongPress={(event) => {
          if (previewOnHold) preview(tab);
          props.onLongPress?.(event);
        }}
        onPressOut={(event) => {
          preview(null);
          props.onPressOut?.(event);
        }}
        {...focusProps}
        style={[styles.button, keyboardFocused && styles.focused]}
      >
        <View style={[styles.iconWrap, isFocused && styles.iconWrapSelected]}>
          <Icon size={22} color={tint} />
        </View>
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          style={[styles.label, isFocused && styles.labelSelected]}
        >
          {tab.label}
        </Text>
      </Pressable>
    </LargeContentItem>
  );
}

/** The Large Content Viewer selects on lift with no touch event; TabTrigger's handler accepts that on native. */
function selectWithoutEvent(onPress: TabTriggerSlotProps['onPress']) {
  (onPress as (() => void) | undefined)?.();
}

function LargeContentPreview({ tab }: { tab: TabDefinition }) {
  const Icon = tab.icon;
  // A visual aid only: screen readers already announce the full tab label.
  return (
    <View testID="large-content-preview" pointerEvents="none" importantForAccessibility="no-hide-descendants" style={styles.preview}>
      <Icon size={56} color={palette.foreground} />
      <Text allowFontScaling={false} style={styles.previewLabel}>
        {tab.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // TabList's own style lays its children out in a row; the bar is a column holding one row of items.
  bar: {
    flexDirection: 'column',
    justifyContent: 'flex-start',
    backgroundColor: palette.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  items: { alignSelf: 'stretch', flexDirection: 'row', paddingTop: space[1], paddingHorizontal: 6 },
  item: { flex: 1 },
  button: {
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    paddingVertical: space[1],
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: palette.transparent,
  },
  focused: { borderColor: palette.ring },
  iconWrap: {
    width: 56,
    maxWidth: '100%',
    height: 30,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: palette.transparent,
  },
  iconWrapSelected: { backgroundColor: palette.secondary, borderColor: palette.primary },
  label: { fontFamily: fonts.uiMedium, fontSize: 11, color: palette.mutedForeground },
  labelSelected: { fontFamily: fonts.uiBold, color: palette.foreground },
  preview: {
    position: 'absolute',
    bottom: '100%',
    alignSelf: 'center',
    marginBottom: space[4],
    minWidth: 160,
    paddingVertical: space[6],
    paddingHorizontal: space[8],
    borderRadius: radius.lg,
    backgroundColor: palette.secondary,
    borderWidth: 1,
    borderColor: palette.controlBorder,
    alignItems: 'center',
    gap: space[2],
  },
  previewLabel: { fontFamily: fonts.uiBold, fontSize: 28, color: palette.foreground },
});
