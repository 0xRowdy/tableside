// Spec 3 S3-02 ZreSb, FkMDw, Al6Pw; User stories 27, 28; Play challenge funding; #137, #138, #139

import { BLACKJACK_LIMITS, BLACKJACK_PRESETS, DEFAULT_BLACKJACK_PRESET, type TableOptions } from '@tableside/definitions';
import { MAX_CHECKPOINT_INTERVAL, MAX_OTHER_PLAYERS, PENETRATIONS } from '@tableside/engine';
import { Eye, Hand } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { SwitchRow } from '@/components/SwitchRow';
import { AmountField, ChoiceGroup, Help, Section, Stepper } from '@/play/setup/SetupParts';
import { withoutGrouping } from '@/play/units';
import { fonts, palette, radius, space, textScale } from '@/theme/tokens';
import { makeStyles } from '@/theme/type';
import {
  BASE_WAGER,
  BET_SCHEDULE_DETAIL,
  BET_SCHEDULE_TITLE,
  BETTING,
  fundingProblemText,
  STARTING_BALANCE,
  STARTING_BALANCE_HELP,
  tableLimitsHelp,
  COUNT_CHECKPOINTS,
  COUNTING_MODE,
  DEFAULT_PRESET_DETAIL,
  INTERVAL_DETAIL,
  INTERVAL_HELP,
  intervalText,
  MODE_HELP,
  OBSERVE,
  OBSERVE_NOTICE,
  PENETRATION_DETAIL,
  PLAY,
  PLAY_NOTICE,
  PLAYERS_DETAIL,
  playersText,
  PRESET_TEXT,
  RULE_PRESET,
  SEAT_HELP,
  SHOE_AND_TABLE,
  WHO_PLAYS,
  WITH_BASIC,
  WITH_DEVIATIONS,
} from '@/training/blackjack-table-text';
import { tableFundingProblems } from '@/training/service';

export function TableSetupOptions({ options, onChange }: { options: TableOptions; onChange: (options: TableOptions) => void }) {
  const styles = useStyles();
  const set = (change: Partial<TableOptions>) => onChange({ ...options, ...change });
  const step = PENETRATIONS.indexOf(options.penetration);
  return (
    <>
      <Section label={WHO_PLAYS}>
        <ChoiceGroup
          label="Who plays your seat"
          options={[
            { label: OBSERVE, selected: options.seat === 'observe', onPress: () => set({ seat: 'observe' }) },
            { label: PLAY, selected: options.seat === 'play', onPress: () => set({ seat: 'play' }) },
          ]}
        />
        <Help>{SEAT_HELP}</Help>
      </Section>
      <Section label={RULE_PRESET}>
        <ChoiceGroup
          label="Rule preset"
          stacked
          options={BLACKJACK_PRESETS.map((preset) => ({
            label: PRESET_TEXT[preset],
            detail: preset === DEFAULT_BLACKJACK_PRESET ? DEFAULT_PRESET_DETAIL : undefined,
            selected: options.preset === preset,
            onPress: () => set({ preset }),
          }))}
        />
      </Section>
      <Section label={SHOE_AND_TABLE}>
        <Stepper
          label="Shoe penetration"
          value={`${options.penetration}%`}
          detail={PENETRATION_DETAIL}
          decrementLabel="Less shoe penetration"
          incrementLabel="More shoe penetration"
          onDecrement={step > 0 ? () => set({ penetration: PENETRATIONS[step - 1] as number }) : null}
          onIncrement={step < PENETRATIONS.length - 1 ? () => set({ penetration: PENETRATIONS[step + 1] as number }) : null}
        />
        <Stepper
          label="Extra simulated players"
          value={playersText(options.extraPlayers)}
          detail={PLAYERS_DETAIL}
          decrementLabel="Fewer extra players"
          incrementLabel="More extra players"
          onDecrement={options.extraPlayers > 0 ? () => set({ extraPlayers: options.extraPlayers - 1 }) : null}
          onIncrement={options.extraPlayers < MAX_OTHER_PLAYERS ? () => set({ extraPlayers: options.extraPlayers + 1 }) : null}
        />
      </Section>
      <Section label={COUNT_CHECKPOINTS}>
        <Stepper
          label="Checkpoint interval"
          value={intervalText(options.interval)}
          detail={INTERVAL_DETAIL}
          decrementLabel="Checkpoints more often"
          incrementLabel="Checkpoints less often"
          onDecrement={options.interval > 1 ? () => set({ interval: options.interval - 1 }) : null}
          onIncrement={options.interval < MAX_CHECKPOINT_INTERVAL ? () => set({ interval: options.interval + 1 }) : null}
        />
        <Help>{INTERVAL_HELP}</Help>
      </Section>
      {options.seat === 'play' && (
        <Section label={COUNTING_MODE}>
          <ChoiceGroup
            label="Counting mode"
            options={[
              { label: WITH_BASIC, selected: options.countingMode === 'basic', onPress: () => set({ countingMode: 'basic' }) },
              { label: WITH_DEVIATIONS, selected: options.countingMode === 'deviations', onPress: () => set({ countingMode: 'deviations' }) },
            ]}
          />
          <Help>{MODE_HELP}</Help>
        </Section>
      )}
      {options.seat === 'play' && <Betting options={options} onChange={set} />}
      <View style={styles.notice} accessible>
        {options.seat === 'observe' ? <Eye color={palette.foreground} size={20} /> : <Hand color={palette.foreground} size={20} />}
        <View style={styles.noticeText}>
          <Text maxFontSizeMultiplier={textScale.body} style={styles.noticeTitle}>
            {(options.seat === 'observe' ? OBSERVE_NOTICE : PLAY_NOTICE).title}
          </Text>
          <Text maxFontSizeMultiplier={textScale.body} style={styles.noticeDetail}>
            {(options.seat === 'observe' ? OBSERVE_NOTICE : PLAY_NOTICE).detail}
          </Text>
        </View>
      </View>
    </>
  );
}

// Spec 3 Play challenge funding › Starting balance; S3-02 FkMDw, Al6Pw
function Betting({ options, onChange }: { options: TableOptions; onChange: (change: Partial<TableOptions>) => void }) {
  const styles = useStyles();
  const { min, max } = BLACKJACK_LIMITS.initial;
  const problems = tableFundingProblems(options);
  const problemFor = (field: 'base-wager' | 'starting-balance') => {
    const problem = problems.find((diagnostic) => diagnostic.field === field);
    return problem ? fundingProblemText(problem, options.startingBalance) : null;
  };
  return (
    <Section label={BETTING}>
      <View style={styles.card}>
        <SwitchRow title={BET_SCHEDULE_TITLE} detail={BET_SCHEDULE_DETAIL} value={options.betSchedule} onChange={(betSchedule) => onChange({ betSchedule })} />
      </View>
      <AmountField
        label={BASE_WAGER}
        accessibilityLabel={`${BASE_WAGER}, in units`}
        value={options.baseWager}
        onChange={(text) => onChange({ baseWager: withoutGrouping(text) })}
        problem={problemFor('base-wager')}
        help={tableLimitsHelp(min, max)}
      />
      <AmountField
        label={STARTING_BALANCE}
        accessibilityLabel={`${STARTING_BALANCE}, in units`}
        value={options.startingBalance}
        onChange={(text) => onChange({ startingBalance: withoutGrouping(text) })}
        problem={problemFor('starting-balance')}
        help={STARTING_BALANCE_HELP}
      />
    </Section>
  );
}

const useStyles = makeStyles((type) => ({
  card: { borderRadius: radius.lg, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.card, overflow: 'hidden' },
  notice: { flexDirection: 'row', gap: space[3], padding: space[4], borderRadius: radius.lg, borderLeftWidth: 4, borderLeftColor: palette.coachAccent, backgroundColor: palette.card },
  noticeText: { flex: 1, gap: space[1] },
  noticeTitle: { fontFamily: fonts.uiSemiBold, ...type.body, color: palette.foreground },
  noticeDetail: { fontFamily: fonts.ui, ...type.secondary, color: palette.mutedForeground },
}));
