// Spec 3 S3-05 r5pCx, T9sCI, qGARl; S3-01 Uq05w; Attempt lifecycle; #135, #136

import type { ChallengeCategory, ChallengeView } from '@tableside/engine';
import { BookOpen, CircleAlert, CircleStop, Eye, Hand, Keyboard, Pause, Play, SkipForward, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Sheet, SheetText } from '@/components/Sheet';
import { fonts, palette, radius, space, textScale } from '@/theme/tokens';
import { END_ATTEMPT, helpText, holdText, RESUME_LABEL, unfinishedText, type HoldContext } from '@/training/challenge-text';
import type { AttemptHold } from '@/training/controller';

export function HoldSheet({
  hold,
  context,
  busy,
  onResume,
  onEnd,
  onClose,
}: {
  hold: AttemptHold;
  context: HoldContext;
  busy: boolean;
  onResume: () => void;
  onEnd: () => void;
  onClose: () => void;
}) {
  const text = holdText(hold, context);
  return (
    <Sheet title={text.title} onClose={onClose} testID="attempt-hold">
      <Text maxFontSizeMultiplier={textScale.body} style={styles.lead}>
        {text.lead}
      </Text>
      {[hold.resumeBlocked, hold.endBlocked].map((problem) => problem && <WarningNote key={problem} text={problem} />)}
      <Button label={RESUME_LABEL} icon={Play} stretch disabled={busy} onPress={onResume} />
      <Button label={END_ATTEMPT} icon={CircleStop} variant="outline" stretch disabled={busy} onPress={onEnd} />
      {text.notes.map((note) => (
        <SheetText key={note} small>
          {note}
        </SheetText>
      ))}
    </Sheet>
  );
}

export function WarningNote({ text }: { text: string }) {
  return (
    <View style={styles.warning}>
      <CircleAlert color={palette.warning} size={20} />
      <Text accessibilityRole="alert" maxFontSizeMultiplier={textScale.body} style={styles.warningText}>
        {text}
      </Text>
    </View>
  );
}

const HELP_ICON: Record<'enter' | 'skip' | 'pause' | 'count' | 'moves', LucideIcon> = { enter: Keyboard, skip: SkipForward, pause: Pause, count: Eye, moves: Hand };

// Spec 3 Learn, Check and assistance (operational help only)
export function HelpSheet({ view, onClose }: { view: Pick<ChallengeView, 'variant' | 'countRange' | 'countAid' | 'table'>; onClose: () => void }) {
  const text = helpText(view);
  return (
    <Sheet title={text.title} onClose={onClose} testID="attempt-help">
      {text.rows.map((row) => {
        const Icon = HELP_ICON[row.key];
        return (
          <View key={row.key} style={styles.row}>
            <Icon color={palette.foreground} size={22} />
            <View style={styles.rowText}>
              <Text maxFontSizeMultiplier={textScale.body} style={styles.rowTitle}>
                {row.title}
              </Text>
              <Text maxFontSizeMultiplier={textScale.body} style={styles.rowDetail}>
                {row.detail}
              </Text>
            </View>
          </View>
        );
      })}
      {text.lessons && (
        <View style={styles.box}>
          <BookOpen color={palette.foreground} size={20} />
          <Text maxFontSizeMultiplier={textScale.body} style={styles.boxText}>
            {text.lessons}
          </Text>
        </View>
      )}
      <Button label={text.back} stretch onPress={onClose} />
    </Sheet>
  );
}

export function UnfinishedSheet({
  view,
  next,
  busy,
  onResume,
  onEnd,
  onClose,
}: {
  view: Pick<ChallengeView, 'category' | 'variant' | 'position' | 'length'>;
  next: ChallengeCategory;
  busy: boolean;
  onResume: () => void;
  onEnd: () => void;
  onClose: () => void;
}) {
  const text = unfinishedText(view, next);
  return (
    <Sheet title={text.title} onClose={onClose} testID="unfinished-attempt">
      <Text maxFontSizeMultiplier={textScale.body} style={styles.lead}>
        {text.lead}
      </Text>
      <Button label={text.resume} icon={Play} stretch disabled={busy} onPress={onResume} />
      <Button label={text.end} icon={CircleStop} variant="outline" stretch disabled={busy} onPress={onEnd} />
      <SheetText small>{text.endNote}</SheetText>
      <SheetText small>{text.free}</SheetText>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  lead: { fontFamily: fonts.ui, fontSize: 16, lineHeight: 23, color: palette.foreground },
  warning: { flexDirection: 'row', gap: space[3], padding: space[4], borderRadius: radius.md, borderWidth: 1, borderColor: palette.warning, backgroundColor: palette.card },
  warningText: { flex: 1, fontFamily: fonts.uiBold, fontSize: 14, lineHeight: 20, color: palette.foreground },
  row: { flexDirection: 'row', gap: space[4] },
  rowText: { flex: 1, gap: space[1] },
  rowTitle: { fontFamily: fonts.uiBold, fontSize: 15, lineHeight: 21, color: palette.foreground },
  rowDetail: { fontFamily: fonts.ui, fontSize: 14, lineHeight: 20, color: palette.mutedForeground },
  box: { flexDirection: 'row', gap: space[3], padding: space[4], borderRadius: radius.lg, borderWidth: 1, borderColor: palette.controlBorder },
  boxText: { flex: 1, fontFamily: fonts.ui, fontSize: 14, lineHeight: 20, color: palette.foreground },
});
