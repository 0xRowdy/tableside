// Spec 2 S2-19

import type { DeviceEntry } from '@tableside/account';
import { Check, CircleCheck, LogOut, Monitor, Smartphone, Tablet } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Sheet, SheetText } from '@/components/Sheet';
import { fonts, palette, radius, space, textScale } from '@/theme/tokens';
import { makeStyles } from '@/theme/type';

import { deviceShortName, lastActiveText, namesList } from './account-text';
import { MethodButton } from './FirstRunParts';

export function DeviceCard({ entry, now, disabled, onSignOut }: { entry: DeviceEntry; now: number; disabled: boolean; onSignOut?: () => void }) {
  const styles = useStyles();
  const label = entry.label ?? 'Unknown device';
  const active = lastActiveText(entry.lastActiveAt, now);
  const Glyph = entry.platform === 'web' ? Monitor : entry.label?.startsWith('iPad') ? Tablet : Smartphone;
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

export function SignOutDevicesSheet({
  names,
  all,
  thisDevice,
  busy,
  onConfirm,
  onClose,
}: {
  names: readonly string[];
  all: boolean;
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

export function DoneBanner({ names, email }: { names: readonly string[]; email: string | null }) {
  const styles = useStyles();
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

const useStyles = makeStyles((type) => ({
  card: { gap: space[3] - 2, padding: space[4], borderRadius: radius.lg, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.card },
  head: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space[3] },
  lead: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.secondary },
  text: { flex: 1, minWidth: 140, gap: 2 },
  title: { fontFamily: fonts.uiSemiBold, ...type.body, color: palette.foreground },
  detail: { fontFamily: fonts.ui, ...type.secondary, color: palette.mutedForeground },
  badge: { flexDirection: 'row', alignItems: 'center', gap: space[1] + 2, paddingVertical: space[1], paddingHorizontal: space[3] - 2, borderRadius: radius.pill, backgroundColor: palette.muted },
  badgeText: { fontFamily: fonts.uiMedium, ...type.caption, color: palette.mutedForeground },
  banner: { flexDirection: 'row', gap: space[3], padding: space[3] + 2, borderRadius: radius.lg, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.card },
  bannerText: { flex: 1, gap: space[1] },
  bannerTitle: { fontFamily: fonts.uiSemiBold, ...type.body, color: palette.foreground },
}));
