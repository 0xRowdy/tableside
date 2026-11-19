// Spec 3 S3-02 buD2R, ZreSb, Al6Pw, Amendment 4 §2–3; Lessons › Entry points
// #158, #150, #145, #135, #136, #140, #137, #139

import { CHALLENGE_VARIANTS, type ChallengeVariant } from '@tableside/engine';
import { BookOpen, CircleAlert, Play } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Segmented } from '@/components/Segmented';
import { SwitchRow } from '@/components/SwitchRow';
import { LearnRow } from '@/lessons/LessonEntries';
import { SettingsScreen } from '@/settings/SettingsParts';
import { fonts, palette, radius, space, textScale } from '@/theme/tokens';
import { makeStyles } from '@/theme/type';
import {
  CATEGORY_TEXT,
  COUNTING_TITLE,
  NOT_READY_HINT,
  PACE_GROUP,
  PACE_HELP,
  PACE_LABEL,
  paceOption,
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
import { pacingOf, tableFundingProblems, type CatalogEntry, type ChallengeSetup, type LessonEntry, type StartProblem } from '@/training/service';

import { AllowanceBanner } from './AllowanceBanner';
import { TableSetupOptions } from './TableSetupOptions';
import { CHECK_PLAY_HELP, FIX_ONE_SETTING, NOTHING_STARTED, START_UNAVAILABLE, START_UNAVAILABLE_SHORT } from '@/training/blackjack-table-text';

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
  const styles = useStyles();
  const text = CATEGORY_TEXT[entry.category];
  // Spec 3 Play challenge funding › Starting balance; S3-02 Al6Pw; #139
  const funding = setup.table ? tableFundingProblems(setup.table) : [];
  const short = funding.some((diagnostic) => diagnostic.problem === 'short');
  return (
    <SettingsScreen title={text.title} back={{ label: COUNTING_TITLE, onPress: onBack }}>
      {funding.length > 0 && (
        <View style={[styles.banner, styles.problem]} testID="setup-problem">
          <CircleAlert color={palette.destructive} size={20} />
          <View style={styles.bannerBody}>
            <Text accessibilityRole="alert" maxFontSizeMultiplier={textScale.body} style={styles.bannerText}>
              {FIX_ONE_SETTING}
            </Text>
            <Text maxFontSizeMultiplier={textScale.body} style={styles.help}>
              {NOTHING_STARTED}
            </Text>
          </View>
        </View>
      )}
      <View style={styles.section}>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.label}>
          {VARIANT_LABEL}
        </Text>
        <Segmented
          label="Variant"
          options={CHALLENGE_VARIANTS.map((variant: ChallengeVariant) => {
            const ready = entry.ready.includes(variant);
            return { value: variant, label: variantLabel(variant), disabled: !ready, hint: ready ? undefined : NOT_READY_HINT };
          })}
          selected={setup.variant}
          onSelect={(variant) => onChange({ ...setup, variant })}
        />
        <Text maxFontSizeMultiplier={textScale.body} style={styles.help}>
          {setup.table?.seat === 'play' && setup.variant === 'check' ? CHECK_PLAY_HELP : VARIANT_HELP}
        </Text>
      </View>
      {setup.table && <TableSetupOptions options={setup.table} onChange={(table) => onChange({ ...setup, table })} />}
      {entry.pacings.length > 1 && (
        <View style={styles.section}>
          <Text maxFontSizeMultiplier={textScale.body} style={styles.label}>
            {PACE_LABEL}
          </Text>
          <Segmented
            label={PACE_GROUP}
            options={entry.pacings.map((pacing) => ({ value: pacing, ...paceOption(pacing) }))}
            selected={pacingOf(setup)}
            onSelect={(pacing) => onChange({ ...setup, pacing })}
          />
          {pacingOf(setup) !== 'self-paced' && (
            <Text maxFontSizeMultiplier={textScale.body} style={styles.help}>
              {PACE_HELP}
            </Text>
          )}
        </View>
      )}
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
      <Button label={startLabel(setup.variant)} icon={Play} stretch disabled={busy || startWaits(allowance) || funding.length > 0} onPress={onStart} />
      {funding.length > 0 && (
        <Text maxFontSizeMultiplier={textScale.body} style={styles.help}>
          {short && funding.length === 1 ? START_UNAVAILABLE_SHORT : START_UNAVAILABLE}
        </Text>
      )}
    </SettingsScreen>
  );
}

const useStyles = makeStyles((type) => ({
  section: { gap: space[3] - 2 },
  label: { fontFamily: fonts.uiSemiBold, ...type.label, color: palette.mutedForeground },
  help: { fontFamily: fonts.ui, ...type.secondary, color: palette.mutedForeground },
  banner: { flexDirection: 'row', gap: space[3], padding: space[4], borderRadius: radius.md, borderWidth: 1, borderColor: palette.controlBorder, backgroundColor: palette.card },
  problem: { borderColor: palette.destructive },
  bannerBody: { flex: 1, gap: space[1] },
  bannerText: { flex: 1, fontFamily: fonts.uiSemiBold, ...type.body, color: palette.foreground },
  card: { borderRadius: radius.md, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.card, overflow: 'hidden' },
}));
