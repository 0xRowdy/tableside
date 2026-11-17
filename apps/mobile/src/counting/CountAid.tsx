// Spec 3 Learn, Check and assistance › Show/hide running count; S3-04 qdnQm, S3-05 EDnGd; #133

import type { ChallengeVariant, RunningCountAid } from '@tableside/engine';
import { Eye } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Sheet, SheetText } from '@/components/Sheet';
import { SwitchRow } from '@/components/SwitchRow';
import { signed } from '@/play/blackjack-text';
import { fonts, palette, radius, space, textScale } from '@/theme/tokens';
import { COUNT_LABEL, countAidDetail, REVEAL_WARNING, SHOW_COUNT, spokenValue } from '@/training/challenge-text';

export function CountAid({
  variant,
  aid,
  enabled,
  onReveal,
}: {
  variant: ChallengeVariant;
  aid: RunningCountAid;
  enabled: boolean;
  onReveal: () => void;
}) {
  const [showing, setShowing] = useState(false);
  const [warning, setWarning] = useState(false);
  const shown = showing && aid.revealed;
  const toggle = (on: boolean) => {
    if (!on || aid.revealed) return setShowing(on);
    if (variant === 'check') return setWarning(true);
    setShowing(true);
    onReveal();
  };
  return (
    <View style={styles.aid}>
      <SwitchRow title={SHOW_COUNT} detail={countAidDetail(variant, aid.revealed, shown)} value={shown} disabled={!enabled && !aid.revealed} onChange={toggle} />
      {shown && aid.count !== null && (
        <View accessible accessibilityLabel={`${COUNT_LABEL} ${spokenValue(aid.count)}`} testID="count-aid" style={styles.count}>
          <Text maxFontSizeMultiplier={textScale.body} style={styles.countLabel}>
            {COUNT_LABEL}
          </Text>
          <Text maxFontSizeMultiplier={textScale.display} style={styles.countValue}>
            {signed(aid.count)}
          </Text>
        </View>
      )}
      {warning && (
        <Sheet title={REVEAL_WARNING.title} onClose={() => setWarning(false)}>
          <Text maxFontSizeMultiplier={textScale.body} style={styles.lead}>
            {REVEAL_WARNING.lead}
          </Text>
          <SheetText>{REVEAL_WARNING.detail}</SheetText>
          <Button label={REVEAL_WARNING.keep} stretch onPress={() => setWarning(false)} />
          <Button
            label={REVEAL_WARNING.show}
            icon={Eye}
            variant="outline"
            stretch
            onPress={() => {
              setWarning(false);
              setShowing(true);
              onReveal();
            }}
          />
        </Sheet>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  aid: { borderRadius: radius.lg, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.card, overflow: 'hidden' },
  count: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space[4], paddingBottom: space[3] },
  countLabel: { fontFamily: fonts.ui, fontSize: 15, color: palette.mutedForeground },
  countValue: { fontFamily: fonts.uiBold, fontSize: 28, color: palette.foreground },
  lead: { fontFamily: fonts.ui, fontSize: 16, lineHeight: 23, color: palette.foreground },
});
