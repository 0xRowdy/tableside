// Building blocks of Devices (S2-19): a device's card (what it calls itself,
// when it was last active, "This device", and Sign out this device), the
// sheet confirming a sign-out, and the banner once devices are signed out.

import type { DeviceEntry } from '@tableside/account';
import { Check, CircleCheck, LogOut, Smartphone, Tablet } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Sheet, SheetText } from '@/components/Sheet';
import { fonts, palette, radius, space, textScale } from '@/theme/tokens';

import { deviceShortName, lastActiveText, namesList } from './account-text';
import { MethodButton } from './FirstRunParts';

/** One device: an iPad (by its own account of itself) gets the tablet glyph, anything else the phone's. */
export function DeviceCard({ entry, now, disabled, onSignOut }: { entry: DeviceEntry; now: number; disabled: boolean; onSignOut?: () => void }) {
  const label = entry.label ?? 'Unknown device';
  const active = lastActiveText(entry.lastActiveAt, now);
  const Glyph = entry.label?.startsWith('iPad') ? Tablet : Smartphone;
  return (
    <View style={styles.card} testID={`device-${entry.id}`}>
      <View accessible accessibilityLabel={`${label}. ${active}${entry.thisDevice ? '. This device' : ''}`} style={styles.head}>
        <View style={styles.lead}>
          <Glyph color={palette.foreground} size={18} />
        </View>
        <View style={styles.text}>
          <Text maxFontSizeMultiplier={textScale.body} style={styles.title}>
            {label}
          </Text>
          <Text maxFontSizeMultiplier={textScale.body} style={styles.detail}>
            {active}
          </Text>
        </View>
        {entry.thisDevice && (
          <View style={styles.badge}>
            <Check color={palette.mutedForeground} size={12} />
            <Text maxFontSizeMultiplier={textScale.body} style={styles.badgeText}>
              This device
            </Text>
          </View>
        )}
      </View>
      {onSignOut && (
        <Button
          label="Sign out this device"
          accessibilityLabel={`Sign out ${deviceShortName(entry.label)}`}
          icon={LogOut}
          variant="secondary"
          stretch
          disabled={disabled}
          onPress={onSignOut}
        />
      )}
    </View>
  );
}

/** "Sign out Pixel 8?" or "Sign out 2 other devices?": what it does, then the fresh sign-in and the email. */
export function SignOutDevicesSheet({
  names,
  all,
  thisDevice,
  busy,
  onConfirm,
  onClose,
}: {
  names: readonly string[];
  /** Every other device, rather than one. */
  all: boolean;
  /** What the copy calls this device ("iPhone"). */
  thisDevice: string;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const what = all ? `${names.length} other ${names.length === 1 ? 'device' : 'devices'}` : names[0]!;
  return (
    <Sheet title={`Sign out ${what}?`} onClose={onClose} testID="sign-out-devices">
      <SheetText>
        {all
          ? `${namesList(names)} ${names.length === 1 ? 'locks' : 'lock'} Tableside and ${names.length === 1 ? 'keeps its' : 'keep their'} records until someone signs in to this account again. Offline devices find out the next time they connect. This ${thisDevice} stays signed in.`
          : "It locks Tableside on that device and keeps its records until someone signs in to this account again. If it's offline, it'll find out the next time it connects."}
      </SheetText>
      <SheetText small>{"You'll need to confirm it's you first. We'll send a security email."}</SheetText>
      <MethodButton label={`Sign out ${what}`} icon={LogOut} variant="primary" disabled={busy} onPress={onConfirm} />
      <MethodButton label="Cancel" variant="ghost" disabled={busy} onPress={onClose} />
    </Sheet>
  );
}

/** "Signed out 2 other devices": they can't open the account, and the security email went out. */
export function DoneBanner({ names, email }: { names: readonly string[]; email: string | null }) {
  const title = names.length === 1 ? `Signed out ${names[0]}` : `Signed out ${names.length} other devices`;
  const emailed = email ? ` We've sent a security email to ${email}.` : " We've sent a security email.";
  return (
    <View style={styles.banner}>
      <CircleCheck color={palette.correct} size={20} />
      <View style={styles.bannerText}>
        <Text accessibilityRole="alert" maxFontSizeMultiplier={textScale.body} style={styles.bannerTitle}>
          {title}
        </Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.detail}>
          {`${namesList(names)} can't open your account until someone signs in again.${emailed}`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: space[3] - 2, padding: space[4], borderRadius: radius.lg, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.card },
  head: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space[3] },
  lead: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.secondary },
  text: { flex: 1, minWidth: 140, gap: 2 },
  title: { fontFamily: fonts.uiBold, fontSize: 15, lineHeight: 21, color: palette.foreground },
  detail: { fontFamily: fonts.ui, fontSize: 13, lineHeight: 18, color: palette.mutedForeground },
  badge: { flexDirection: 'row', alignItems: 'center', gap: space[1] + 2, paddingVertical: space[1], paddingHorizontal: space[3] - 2, borderRadius: radius.pill, backgroundColor: palette.muted },
  badgeText: { fontFamily: fonts.uiMedium, fontSize: 12, color: palette.mutedForeground },
  banner: { flexDirection: 'row', gap: space[3], padding: space[3] + 2, borderRadius: radius.lg, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.card },
  bannerText: { flex: 1, gap: space[1] },
  bannerTitle: { fontFamily: fonts.uiBold, fontSize: 14, color: palette.foreground },
});
