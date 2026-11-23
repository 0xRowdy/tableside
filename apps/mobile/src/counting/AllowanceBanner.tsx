// Spec 3 S3-01 GV4tz, RqPCB, S3-02 Ufuiu; spec 5 S5-17 j3UhJ; #150, #55

import { CircleSlash, Smartphone, Ticket } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { fonts, palette, radius, space, textScale } from '@/theme/tokens';
import { makeStyles } from '@/theme/type';
import type { AllowanceCopy } from '@/training/challenge-text';

const ICON = { premium: Ticket, available: Ticket, 'used-up': CircleSlash, elsewhere: Smartphone } as const;

export function AllowanceBanner({ standing, title, detail = null }: { standing: AllowanceCopy['standing']; title: string; detail?: string | null }) {
  const styles = useStyles();
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
}));
