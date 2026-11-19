// Spec 3 Learn, Check and assistance › Show/hide running count; S3-04 qdnQm, S3-05 EDnGd; #133

import type { ChallengeVariant, RunningCountAid } from '@tableside/engine';
import { Eye } from 'lucide-react-native';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Sheet, SheetText } from '@/components/Sheet';
import { SwitchRow } from '@/components/SwitchRow';
import { signed } from '@/play/blackjack-text';
import { fonts, palette, radius, space, textScale } from '@/theme/tokens';
import { makeStyles } from '@/theme/type';
import { COUNT_LABEL, countAidDetail, REVEAL_WARNING, SHOW_COUNT, spokenValue } from '@/training/challenge-text';

export interface CountAidState {
  readonly variant: ChallengeVariant;
  readonly aid: RunningCountAid;
  readonly shown: boolean;
  readonly warning: boolean;
  readonly toggle: (on: boolean) => void;
  readonly keep: () => void;
  readonly show: () => void;
}

export function useCountAid(variant: ChallengeVariant, aid: RunningCountAid, onReveal: () => void): CountAidState {
  const [showing, setShowing] = useState(false);
  const [warning, setWarning] = useState(false);
  return {
    variant,
    aid,
    shown: showing && aid.revealed,
    warning,
    toggle: (on) => {
      if (!on || aid.revealed) return setShowing(on);
      if (variant === 'check') return setWarning(true);
      setShowing(true);
      onReveal();
    },
    keep: () => setWarning(false),
    show: () => {
      setWarning(false);
      setShowing(true);
      onReveal();
    },
  };
}

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
  const styles = useStyles();
  const state = useCountAid(variant, aid, onReveal);
  return (
    <View style={styles.aid}>
      <CountAidSwitch state={state} enabled={enabled} />
      <CountAidValue state={state} />
    </View>
  );
}

export function CountAidSwitch({ state, enabled }: { state: CountAidState; enabled: boolean }) {
  const styles = useStyles();
  return (
    <>
      <SwitchRow title={SHOW_COUNT} detail={countAidDetail(state.variant, state.aid.revealed, state.shown)} value={state.shown} disabled={!enabled && !state.aid.revealed} onChange={state.toggle} />
      {state.warning && (
        <Sheet title={REVEAL_WARNING.title} onClose={state.keep}>
          <Text maxFontSizeMultiplier={textScale.body} style={styles.lead}>
            {REVEAL_WARNING.lead}
          </Text>
          <SheetText>{REVEAL_WARNING.detail}</SheetText>
          <Button label={REVEAL_WARNING.keep} stretch onPress={state.keep} />
          <Button label={REVEAL_WARNING.show} icon={Eye} variant="outline" stretch onPress={state.show} />
        </Sheet>
      )}
    </>
  );
}

export function CountAidValue({ state }: { state: CountAidState }) {
  const styles = useStyles();
  const { count } = state.aid;
  if (!state.shown || count === null) return null;
  return (
    <View accessible accessibilityLabel={`${COUNT_LABEL} ${spokenValue(count)}`} testID="count-aid" style={styles.count}>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.countLabel}>
        {COUNT_LABEL}
      </Text>
      <Text maxFontSizeMultiplier={textScale.display} style={styles.countValue}>
        {signed(count)}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((type) => ({
  aid: { borderRadius: radius.lg, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.card, overflow: 'hidden' },
  count: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space[4], paddingBottom: space[3] },
  countLabel: { fontFamily: fonts.ui, ...type.secondary, color: palette.mutedForeground },
  countValue: { fontFamily: fonts.uiBold, ...type.figure, color: palette.foreground },
  lead: { fontFamily: fonts.ui, ...type.body, color: palette.foreground },
}));
