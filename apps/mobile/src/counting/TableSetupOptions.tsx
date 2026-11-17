// Spec 3 S3-02 ZreSb; User stories 27; #137

import { BLACKJACK_PRESETS, DEFAULT_BLACKJACK_PRESET, type TableOptions } from '@tableside/definitions';
import { MAX_CHECKPOINT_INTERVAL, MAX_OTHER_PLAYERS, PENETRATIONS } from '@tableside/engine';
import { Eye } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { ChoiceGroup, Help, Section, Stepper } from '@/play/setup/SetupParts';
import { fonts, palette, radius, space, textScale } from '@/theme/tokens';
import {
  COUNT_CHECKPOINTS,
  DEFAULT_PRESET_DETAIL,
  INTERVAL_DETAIL,
  INTERVAL_HELP,
  intervalText,
  OBSERVE,
  OBSERVE_NOTICE,
  PENETRATION_DETAIL,
  PLAY,
  PLAYERS_DETAIL,
  playersText,
  PRESET_TEXT,
  RULE_PRESET,
  SEAT_HELP,
  SHOE_AND_TABLE,
  WHO_PLAYS,
} from '@/training/blackjack-table-text';
import { NOT_READY_HINT } from '@/training/challenge-text';

export function TableSetupOptions({ options, onChange }: { options: TableOptions; onChange: (options: TableOptions) => void }) {
  const set = (change: Partial<TableOptions>) => onChange({ ...options, ...change });
  const step = PENETRATIONS.indexOf(options.penetration);
  return (
    <>
      <Section label={WHO_PLAYS}>
        <ChoiceGroup
          label="Who plays your seat"
          options={[
            { label: OBSERVE, selected: options.seat === 'observe', onPress: () => set({ seat: 'observe' }) },
            // TODO(#139)
            { label: PLAY, selected: false, disabled: true, disabledHint: NOT_READY_HINT, onPress: () => undefined },
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
      {options.seat === 'observe' && (
        <View style={styles.notice} accessible>
          <Eye color={palette.foreground} size={20} />
          <View style={styles.noticeText}>
            <Text maxFontSizeMultiplier={textScale.body} style={styles.noticeTitle}>
              {OBSERVE_NOTICE.title}
            </Text>
            <Text maxFontSizeMultiplier={textScale.body} style={styles.noticeDetail}>
              {OBSERVE_NOTICE.detail}
            </Text>
          </View>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  notice: { flexDirection: 'row', gap: space[3], padding: 14, borderRadius: radius.lg, borderLeftWidth: 4, borderLeftColor: palette.coachAccent, backgroundColor: palette.card },
  noticeText: { flex: 1, gap: space[1] },
  noticeTitle: { fontFamily: fonts.uiBold, fontSize: 15, color: palette.foreground },
  noticeDetail: { fontFamily: fonts.ui, fontSize: 14, lineHeight: 20, color: palette.mutedForeground },
});
