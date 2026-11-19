// Spec 3 Lessons › Check protection; Amendment 1 A2, Amendment 3; S3-14 SUUN4; #149
import { PLAY_CHECK_WITHHELD_MODES, type BlackjackMode } from '@tableside/definitions';
import { router } from 'expo-router';
import { ArrowLeft, CircleStop } from 'lucide-react-native';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { NavButton } from '@/lessons/LessonParts';
import { attemptHref } from '@/lessons/routes';
import { NEEDS_UPDATE } from '@/training/challenge-text';
import { END_TO_PRACTICE, ENDING_ABANDONS, PRACTICE_AFTER_ATTEMPT, practiceHeldText, RETURN_TO_ATTEMPT } from '@/training/lesson-text';
import { useInstructionWithheld, useTraining } from '@/training/TrainingProvider';
import { fonts, palette, space, textScale } from '@/theme/tokens';
import { makeStyles } from '@/theme/type';

export function useModeWithheld(mode: BlackjackMode | null): boolean | undefined {
  const withheld = useInstructionWithheld();
  if (mode === null || !PLAY_CHECK_WITHHELD_MODES.includes(mode)) return false;
  return withheld === undefined ? undefined : withheld?.play === true;
}

export function PracticeHold({ mode }: { mode: BlackjackMode }) {
  const styles = useStyles();
  const { service, snapshot } = useTraining();
  const withheld = useInstructionWithheld();
  const [busy, setBusy] = useState(false);
  const endBlocked = snapshot.status === 'needs-update' ? NEEDS_UPDATE : snapshot.status === 'active' ? (snapshot.hold?.endBlocked ?? null) : null;
  if (!withheld) return null;
  return (
    <View style={styles.hold}>
      <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.display} style={styles.heading}>
        {PRACTICE_AFTER_ATTEMPT}
      </Text>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.text}>
        {practiceHeldText(withheld, mode)}
      </Text>
      {endBlocked && (
        <Text accessibilityRole="alert" maxFontSizeMultiplier={textScale.body} style={styles.alert}>
          {endBlocked}
        </Text>
      )}
      <NavButton icon={ArrowLeft} label={RETURN_TO_ATTEMPT} primary block disabled={false} onPress={() => router.navigate(attemptHref)} />
      <NavButton
        icon={CircleStop}
        label={END_TO_PRACTICE}
        block
        disabled={busy || snapshot.status !== 'active'}
        onPress={() => {
          setBusy(true);
          void service.end({ showResults: false }).finally(() => setBusy(false));
        }}
      />
      <Text maxFontSizeMultiplier={textScale.body} style={styles.footnote}>
        {ENDING_ABANDONS}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((type) => ({
  hold: { gap: space[4] },
  heading: { fontFamily: fonts.display, ...type.headline, color: palette.foreground },
  text: { fontFamily: fonts.ui, ...type.secondary, color: palette.mutedForeground },
  alert: { fontFamily: fonts.ui, ...type.body, color: palette.warning },
  footnote: { fontFamily: fonts.ui, ...type.secondary, color: palette.mutedForeground },
}))
