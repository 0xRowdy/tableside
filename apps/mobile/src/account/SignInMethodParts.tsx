// Building blocks of Sign-in methods (S2-18): a method's card with its
// actions, an "Add a method" row, and the banners for a method that belongs to
// another account and for the last method.

import type { SignInMethod, SignInMethodEntry } from '@tableside/account';
import { ChevronRight, Lock, Mail, Pencil, Users, X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import { fonts, palette, radius, space, textScale } from '@/theme/tokens';

import { LinkButton } from './FirstRunParts';
import { methodDetail, methodName } from './method-text';
import { PROVIDERS } from './providers';

/** A method's glyph: Apple's, Google's, or an envelope for the email code. */
function MethodIcon({ method }: { method: SignInMethod }) {
  if (method === 'email') return <Mail color={palette.foreground} size={18} />;
  const Glyph = PROVIDERS[method].icon;
  return <Glyph color={palette.foreground} size={18} />;
}

/** One method: its name and address, then Remove (and Change email, for the email code). */
export function MethodCard({
  entry,
  onRemove,
  onChangeEmail,
  disabled,
  children,
}: {
  entry: SignInMethodEntry;
  onRemove: () => void;
  onChangeEmail?: () => void;
  disabled: boolean;
  /** Shown under the card: the last-method banner. */
  children?: ReactNode;
}) {
  const name = methodName(entry.method);
  const detail = methodDetail(entry);
  return (
    <View style={styles.card} testID={`method-${entry.id}`}>
      <View accessible accessibilityLabel={detail ? `${name}. ${detail}` : name} style={styles.head}>
        <View style={styles.lead}>
          <MethodIcon method={entry.method} />
        </View>
        <View style={styles.text}>
          <Text maxFontSizeMultiplier={textScale.body} style={styles.title}>
            {name}
          </Text>
          {detail && (
            <Text maxFontSizeMultiplier={textScale.body} style={styles.detail}>
              {detail}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.actions}>
        {onChangeEmail && (
          <View style={styles.action}>
            <Button label="Change email" icon={Pencil} variant="secondary" stretch disabled={disabled} onPress={onChangeEmail} />
          </View>
        )}
        <View style={styles.action}>
          <Button label="Remove" icon={X} accessibilityLabel={`Remove ${name}`} variant="secondary" stretch disabled={disabled} onPress={onRemove} />
        </View>
      </View>
      {children}
    </View>
  );
}

/** A method to add, with why a second one helps. */
export function AddMethodRow({ method, detail, onPress, disabled }: { method: SignInMethod; detail: string; onPress: () => void; disabled: boolean }) {
  const { focused, focusProps } = useKeyboardFocus();
  const name = methodName(method);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Add ${name}. ${detail}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      {...focusProps}
      style={({ pressed }) => [styles.addRow, pressed && styles.pressed, focused && styles.focused]}
    >
      <View style={styles.lead}>
        <MethodIcon method={method} />
      </View>
      <View style={styles.text}>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.title}>
          {name}
        </Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.detail}>
          {detail}
        </Text>
      </View>
      <ChevronRight color={palette.mutedForeground} size={18} />
    </Pressable>
  );
}

/**
 * A card with an icon, a title read as an alert, its explanation and an
 * optional action: the last method (a lock, warning) or a method another
 * account owns (people, destructive).
 */
export function Banner({
  tone,
  title,
  children,
  action,
}: {
  tone: 'last-method' | 'other-account';
  title: string;
  children: string;
  action?: { readonly label: string; readonly onPress: () => void };
}) {
  const Icon = tone === 'last-method' ? Lock : Users;
  return (
    <View style={styles.banner}>
      <Icon color={tone === 'last-method' ? palette.warning : palette.destructive} size={20} />
      <View style={styles.bannerText}>
        <Text accessibilityRole="alert" maxFontSizeMultiplier={textScale.body} style={styles.bannerTitle}>
          {title}
        </Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.detail}>
          {children}
        </Text>
        {action && <LinkButton label={action.label} onPress={action.onPress} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: space[3] - 2, padding: space[4], borderRadius: radius.lg, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.card },
  head: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  lead: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.secondary },
  text: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.uiBold, fontSize: 15, lineHeight: 21, color: palette.foreground },
  detail: { fontFamily: fonts.ui, fontSize: 13, lineHeight: 18, color: palette.mutedForeground },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  action: { flexGrow: 1, flexBasis: 140 },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    minHeight: 64,
    paddingVertical: space[3],
    paddingHorizontal: space[4],
    borderWidth: 2,
    borderColor: palette.transparent,
  },
  pressed: { backgroundColor: palette.secondary },
  focused: { borderColor: palette.ring },
  banner: { flexDirection: 'row', gap: space[3], padding: space[3] + 2, borderRadius: radius.lg, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.card },
  bannerText: { flex: 1, gap: space[1] },
  bannerTitle: { fontFamily: fonts.uiBold, fontSize: 14, color: palette.foreground },
});
