// Spec 3 S3-02 buD2R, ZreSb, Amendment 4 §2–3; Lessons › Entry points; #158, #150, #145, #135, #140

import { CHALLENGE_VARIANTS, type ChallengeVariant } from '@tableside/engine';
import { BookOpen, CircleAlert, Play } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { SwitchRow } from '@/components/SwitchRow';
import { LearnRow } from '@/lessons/LessonEntries';
import { SettingsScreen } from '@/settings/SettingsParts';
import { fonts, palette, space, textScale } from '@/theme/tokens';
import {
  CATEGORY_TEXT,
  COUNTING_TITLE,
  NOT_READY_HINT,
  START_PROBLEM,
  startLabel,
  startWaits,
  TIME_THIS,
  TIME_THIS_DETAIL,
  TIMING_LABEL,
  VARIANT_LABEL,
  VARIANT_HELP,
  variantLabel,
  WHAT_YOU_DO,
  WHAT_YOU_DO_LABEL,
  type AllowanceCopy,
} from '@/training/challenge-text';
import { LEARN_THIS_SKILL, learnThisSkillDetail } from '@/training/lesson-text';
import type { CatalogEntry, ChallengeSetup, LessonEntry, StartProblem } from '@/training/service';

import { AllowanceBanner } from './AllowanceBanner';
import { Segmented } from './Segmented';

export function ChallengeSetupScreen({
  entry,
  setup,
  allowance,
  problem,
  busy,
  lesson,
  onOpenLesson,
  onChange,
  onStart,
  onBack,
}: {
  entry: CatalogEntry;
  setup: ChallengeSetup;
  allowance: AllowanceCopy | undefined;
  problem: StartProblem | null;
  busy: boolean;
  lesson: LessonEntry | undefined;
  onOpenLesson: (lesson: string) => void;
  onChange: (setup: ChallengeSetup) => void;
  onStart: () => void;
  onBack: () => void;
}) {
  const text = CATEGORY_TEXT[entry.category];
  return (
    <SettingsScreen title={text.title} back={{ label: COUNTING_TITLE, onPress: onBack }}>
      <View style={styles.section}>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.label}>
          {VARIANT_LABEL}
        </Text>
        <Segmented
          label="Variant"
          options={CHALLENGE_VARIANTS.map((variant: ChallengeVariant) => ({ value: variant, label: variantLabel(variant), disabled: !entry.ready.includes(variant), hint: entry.ready.includes(variant) ? undefined : NOT_READY_HINT }))}
          selected={setup.variant}
          onSelect={(variant) => onChange({ ...setup, variant })}
        />
        <Text maxFontSizeMultiplier={textScale.body} style={styles.help}>
          {VARIANT_HELP}
        </Text>
      </View>
      <View style={styles.section}>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.label}>
          {TIMING_LABEL}
        </Text>
        <View style={styles.card}>
          <SwitchRow title={TIME_THIS} detail={TIME_THIS_DETAIL} value={setup.timed === true} onChange={(timed) => onChange({ ...setup, timed })} />
        </View>
      </View>
      {WHAT_YOU_DO[entry.category] && (
        <View style={styles.section}>
          <Text maxFontSizeMultiplier={textScale.body} style={styles.label}>
            {WHAT_YOU_DO_LABEL}
          </Text>
          <Text maxFontSizeMultiplier={textScale.body} style={styles.help}>
            {WHAT_YOU_DO[entry.category]}
          </Text>
        </View>
      )}
      {lesson && <LearnRow icon={BookOpen} title={LEARN_THIS_SKILL} detail={learnThisSkillDetail(lesson)} disabled={lesson.steps === null} onPress={() => onOpenLesson(lesson.id)} />}
      {allowance && <AllowanceBanner standing={allowance.standing} title={allowance.setup.text} action={allowance.setup.action} />}
      {problem && (
        <View style={[styles.banner, styles.problem]}>
          <CircleAlert color={palette.destructive} size={20} />
          <Text accessibilityRole="alert" maxFontSizeMultiplier={textScale.body} style={styles.bannerText}>
            {START_PROBLEM[problem]}
          </Text>
        </View>
      )}
      <Button label={startLabel(setup.variant)} icon={Play} stretch disabled={busy || startWaits(allowance)} onPress={onStart} />
    </SettingsScreen>
  );
}

const styles = StyleSheet.create({
  section: { gap: space[3] - 2 },
  label: { fontFamily: fonts.uiBold, fontSize: 12, letterSpacing: 0.6, color: palette.mutedForeground },
  help: { fontFamily: fonts.ui, fontSize: 13, lineHeight: 19, color: palette.mutedForeground },
  banner: { flexDirection: 'row', gap: space[3], padding: 14, borderRadius: 12, borderWidth: 1, borderColor: palette.controlBorder, backgroundColor: palette.card },
  problem: { borderColor: palette.destructive },
  bannerText: { flex: 1, fontFamily: fonts.uiBold, fontSize: 14, lineHeight: 20, color: palette.foreground },
  card: { borderRadius: 12, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.card, overflow: 'hidden' },
});
