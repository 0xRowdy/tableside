// Spec 1 S1-08

import { FUNDING_CEILING, type DomainFact, type PermittedView } from '@tableside/engine';
import { X } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native';

import { Button } from '@/components/Button';
import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import { fonts, MIN_TOUCH_TARGET, palette, radius, space, textScale } from '@/theme/tokens';
import { makeStyles } from '@/theme/type';

import { formatUnits, sumUnits, wholeUnits } from './units';

const FULL_SCREEN_FONT_SCALE = 1.35;
const MAX_DIGITS = 13;

function parseDraft(draft: string): string | null {
  const digits = draft.replace(/[,\s]/g, '');
  if (!/^\d+$/.test(digits) || digits.length > MAX_DIGITS) return null;
  const amount = wholeUnits(digits);
  return amount !== '0' ? amount : null;
}

function wasRefused(facts: readonly DomainFact[], amount: string | null) {
  return facts.some((fact) => fact.kind === 'illegal-action' && fact.command.kind === 'rebuy' && fact.command.amount === amount);
}

export function RebuySheet({
  funding,
  sequence,
  facts,
  busy,
  onAdd,
  onClose,
}: {
  funding: PermittedView['funding'];
  sequence: number;
  facts: readonly DomainFact[];
  busy: boolean;
  onAdd: (amount: string) => void;
  onClose: () => void;
}) {
  const styles = useStyles();
  const { fontScale } = useWindowDimensions();
  const fullScreen = fontScale > FULL_SCREEN_FONT_SCALE;
  const [draft, setDraft] = useState(formatUnits(funding.buyIn));
  const [notWhole, setNotWhole] = useState(false);
  const [openedAt] = useState(sequence);
  const amount = parseDraft(draft);
  const refused = sequence > openedAt && wasRefused(facts, amount);
  const rebuysSoFar = sumUnits(...funding.rebuys);
  const after = amount === null ? null : sumUnits(funding.cumulative, amount);
  const label = amount === null ? 'Add to this session' : `Add ${formatUnits(amount)} to this session`;

  const add = () => {
    setNotWhole(amount === null);
    if (amount !== null) onAdd(amount);
  };

  const rows = refused
    ? [
        { label: 'Total funding so far', value: funding.cumulative },
        { label: 'Funding limit per session', value: FUNDING_CEILING.toString() },
        { label: 'Room left', value: funding.headroom },
      ]
    : [
        { label: 'Buy-in', value: funding.buyIn },
        { label: 'Rebuys so far', value: rebuysSoFar },
        ...(after === null ? [] : [{ label: 'Total funding after this', value: after }]),
      ];

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
      <View style={[styles.scrim, fullScreen && styles.scrimFull]}>
        <View testID="rebuy-sheet" accessibilityViewIsModal style={[styles.sheet, fullScreen && styles.sheetFull]}>
          <ScrollView testID="rebuy-scroll" contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.display} style={styles.title}>
                Rebuy
              </Text>
              <CloseButton onPress={onClose} />
            </View>
            <Text maxFontSizeMultiplier={textScale.body} style={styles.text}>
              Add chips to this session. A rebuy isn&apos;t a win: your net result and drawdown count it as money you put in.
            </Text>

            <View style={styles.section}>
              <Text maxFontSizeMultiplier={textScale.body} style={styles.fieldLabel}>Rebuy amount</Text>
              <View style={[styles.field, (refused || notWhole) && styles.fieldError]}>
                <TextInput
                  accessibilityLabel="Rebuy amount, in units"
                  value={draft}
                  onChangeText={(text) => {
                    setDraft(text);
                    setNotWhole(false);
                  }}
                  keyboardType="number-pad"
                  maxFontSizeMultiplier={textScale.body}
                  style={styles.input}
                />
                <Text maxFontSizeMultiplier={textScale.body} style={styles.unit}>units</Text>
              </View>
              {refused ? (
                <Text accessibilityRole="alert" maxFontSizeMultiplier={textScale.body} style={styles.error}>
                  That would take total funding past the {formatUnits(FUNDING_CEILING.toString())} limit. You can add up to{' '}
                  {formatUnits(funding.headroom)}.
                </Text>
              ) : notWhole ? (
                <Text accessibilityRole="alert" maxFontSizeMultiplier={textScale.body} style={styles.error}>
                  Enter whole units, at least 1.
                </Text>
              ) : (
                <Text maxFontSizeMultiplier={textScale.body} style={styles.help}>
                  Prefilled with your buy-in. Edit it if you like. Whole units.
                </Text>
              )}
            </View>

            <View style={styles.ledger}>
              {rows.map((row) => (
                <View key={row.label} style={styles.kv} accessible accessibilityLabel={`${row.label} ${formatUnits(row.value)}`}>
                  <Text maxFontSizeMultiplier={textScale.body} style={styles.muted}>{row.label}</Text>
                  <Text maxFontSizeMultiplier={textScale.body} style={styles.kvValue}>{formatUnits(row.value)}</Text>
                </View>
              ))}
            </View>
            {refused && (
              <Text maxFontSizeMultiplier={textScale.body} style={styles.help}>
                Winnings don&apos;t count toward this limit and are never capped.
              </Text>
            )}

            <Button label={label} stretch disabled={busy || refused} onPress={add} />
            {refused && funding.headroom !== '0' ? (
              <Button
                label={`Change amount to ${formatUnits(funding.headroom)}`}
                variant="secondary"
                stretch
                onPress={() => setDraft(formatUnits(funding.headroom))}
              />
            ) : (
              <Button label="Cancel" variant="secondary" stretch onPress={onClose} />
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function CloseButton({ onPress }: { onPress: () => void }) {
  const styles = useStyles();
  const { focused, focusProps } = useKeyboardFocus();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Close"
      onPress={onPress}
      {...focusProps}
      style={[styles.close, focused && styles.focused]}
    >
      <X color={palette.foreground} size={20} />
    </Pressable>
  );
}

const useStyles = makeStyles((type) => ({
  scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: palette.scrim },
  scrimFull: { justifyContent: 'flex-start' },
  sheet: { maxHeight: '90%', borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, backgroundColor: palette.popover },
  sheetFull: { flexGrow: 1, maxHeight: '100%', borderRadius: 0 },
  content: { gap: space[4], padding: space[6] },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2] },
  title: { flex: 1, fontFamily: fonts.display, ...type.headline, color: palette.foreground },
  text: { fontFamily: fonts.ui, ...type.secondary, color: palette.mutedForeground },
  section: { gap: space[1] },
  fieldLabel: { fontFamily: fonts.uiMedium, ...type.secondary, color: palette.foreground },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: space[3],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.controlBorder,
    backgroundColor: palette.card,
  },
  fieldError: { borderColor: palette.destructive, borderWidth: 2 },
  input: { flex: 1, minHeight: MIN_TOUCH_TARGET, fontFamily: fonts.uiMedium, ...type.body, color: palette.foreground },
  unit: { fontFamily: fonts.ui, ...type.secondary, color: palette.mutedForeground },
  help: { fontFamily: fonts.ui, ...type.secondary, color: palette.mutedForeground },
  error: { fontFamily: fonts.uiMedium, ...type.secondary, color: palette.destructive },
  ledger: { gap: space[2] },
  kv: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: space[2] },
  muted: { fontFamily: fonts.ui, ...type.secondary, color: palette.mutedForeground },
  kvValue: { fontFamily: fonts.uiMedium, ...type.body, color: palette.foreground },
  close: {
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: palette.transparent,
  },
  focused: { borderColor: palette.ring },
}))
