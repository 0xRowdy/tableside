// Spec 3 S3-01 PDCaD, RqPCB, S3-02 buD2R; spec 5 S5-17 j3UhJ; #150

import { CircleSlash, Smartphone, Ticket } from 'lucide-react-native';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { LinkButton } from '@/play/setup/SetupParts';
import { fonts, palette, radius, space, textScale } from '@/theme/tokens';
import { makeStyles } from '@/theme/type';
import { ALLOWANCE_ACTION_LABEL, ARRIVES_LATER, type AllowanceAction, type AllowanceCopy } from '@/training/challenge-text';

const ICON = { premium: Ticket, available: Ticket, 'used-up': CircleSlash, elsewhere: Smartphone } as const;

export function AllowanceBanner({
  standing,
  title,
  detail = null,
  action,
}: {
  standing: AllowanceCopy['standing'];
  title: string;
  detail?: string | null;
  action: AllowanceAction | null;
}) {
  const styles = useStyles();
  const [showArrivesLater, setShowArrivesLater] = useState(false);
  const usedUp = standing === 'used-up';
  const Icon = ICON[standing];
  return (
    <View testID="allowance-banner" style={[styles.banner, usedUp && styles.usedUp]}>
      <Icon color={usedUp ? palette.warning : palette.foreground} size={20} />
      <View style={styles.text}>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.title}>
          {title}
        </Text>
        {detail && (
          <Text maxFontSizeMultiplier={textScale.body} style={styles.detail}>
            {detail}
          </Text>
        )}
        {action && <LinkButton label={ALLOWANCE_ACTION_LABEL[action]} onPress={() => setShowArrivesLater(true)} />}
        {action && showArrivesLater && (
          <Text accessibilityRole="alert" maxFontSizeMultiplier={textScale.body} style={styles.detail}>
            {ARRIVES_LATER[action]}
          </Text>
        )}
      </View>
    </View>
  );
}

const useStyles = makeStyles((type) => ({
  banner: { flexDirection: 'row', gap: space[3], padding: space[4], borderRadius: radius.md, borderWidth: 1, borderColor: palette.controlBorder, backgroundColor: palette.card },
  usedUp: { borderColor: palette.warning },
  text: { flex: 1, gap: space[1] },
  title: { fontFamily: fonts.uiSemiBold, ...type.body, color: palette.foreground },
  detail: { fontFamily: fonts.ui, ...type.secondary, color: palette.mutedForeground },
}))
