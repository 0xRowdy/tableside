// The named bet selector (design frames "S1-03 Bet selector"): every wager on
// the table as a readable list, a wager editor that sets a total stake, and the
// wagers already placed. It is game-agnostic: a game hands it a catalog built
// from the permitted view and the wagers on the table, and it sends the same
// place-wager commands as the graphical table. The engine judges legality.

import { compare, decodeMoney, type DomainFact, type IllegalActionReason } from '@tableside/engine';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, TextInput, View, type HostInstance } from 'react-native';

import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import { fonts, MIN_TOUCH_TARGET, palette, radius, space, textScale } from '@/theme/tokens';

import { formatUnits } from '../units';
import {
  findChoice,
  findKind,
  isDraftPending,
  parseStake,
  stepStake,
  type BetDraft,
  type PlacedWager,
  type WagerCatalog,
  type WagerChoice,
  type WagerKind,
} from './catalog';

export interface BetSelectorProps {
  readonly catalog: WagerCatalog;
  readonly wagers: readonly PlacedWager[];
  /** The available balance (funds not on the table). */
  readonly balance: string;
  /** Facts of the latest committed transition and the view sequence after it. */
  readonly facts: readonly DomainFact[];
  readonly sequence: number;
  /** False while the engine doesn't accept wagers or a command is in flight. */
  readonly canPlace: boolean;
  readonly draft: BetDraft;
  readonly onDraftChange: (draft: BetDraft) => void;
  /** Sets the total stake on a target. */
  readonly onSet: (target: string, amount: string) => void;
  readonly onRemove: (target: string) => void;
}

export const DRAFT_NOTE = 'Draft · not placed yet. It stays if you rotate, resize or switch to the table.';

/** Moves screen-reader focus to a control, for focus that must land somewhere meaningful. */
const moveFocus = (ref: React.RefObject<HostInstance | null>) => {
  if (ref.current) AccessibilityInfo.sendAccessibilityEvent(ref.current, 'focus');
};

export function BetSelector(props: BetSelectorProps) {
  const { catalog, draft } = props;
  const kind = findKind(catalog, draft.kind);
  return (
    <View testID="bet-selector" style={styles.selector}>
      {kind ? <WagerEditor {...props} kind={kind} /> : <WagerList {...props} />}
      <YourWagers {...props} />
    </View>
  );
}

function WagerList({ catalog, wagers, draft, onDraftChange }: BetSelectorProps) {
  const staked = (kind: WagerKind) => {
    let total = 0n;
    for (const wager of wagers) if (kind.choices.some((c) => c.target === wager.target)) total += BigInt(wager.amount);
    return total;
  };
  const open = (kind: WagerKind) => {
    // A draft on one of this kind's choices stays; otherwise the kind opens with nothing chosen.
    const keep = kind.choices.some((c) => c.target === draft.target);
    onDraftChange(keep ? { ...draft, kind: kind.id } : { kind: kind.id, target: null, text: '', submittedAt: null });
  };
  return (
    <View style={styles.section}>
      {catalog.sections.map((section) => (
        <View key={section.title} style={styles.group}>
          <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.body} style={styles.sectionLabel}>
            {section.title}
          </Text>
          {section.kinds.map((kind) => {
            const total = staked(kind);
            return (
              <Row
                key={kind.id}
                label={`${kind.name}, ${kind.detail}`}
                value={total > 0n ? `${formatUnits(total.toString())} on the table` : 'no wager'}
                hint="Opens its editor. Nothing is placed until you set a stake."
                onPress={() => open(kind)}
              >
                <View style={styles.rowText}>
                  <Text maxFontSizeMultiplier={textScale.body} style={styles.rowTitle}>{kind.name}</Text>
                  <Text maxFontSizeMultiplier={textScale.body} style={styles.rowDetail}>{kind.detail}</Text>
                </View>
                <Text maxFontSizeMultiplier={textScale.body} style={styles.rowValue}>
                  {total > 0n ? formatUnits(total.toString()) : '—'}
                </Text>
              </Row>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function WagerEditor(props: BetSelectorProps & { kind: WagerKind }) {
  const { kind, draft, wagers, canPlace, onDraftChange, onSet } = props;
  const heading = useRef<HostInstance>(null);
  useEffect(() => moveFocus(heading), [kind.id]);

  const choice = kind.choices.find((c) => c.target === draft.target);
  const placed = choice && wagers.find((w) => w.target === choice.target);
  const choose = (next: WagerChoice) => {
    if (next.target === draft.target) return;
    const existing = wagers.find((w) => w.target === next.target);
    onDraftChange({ kind: kind.id, target: next.target, text: existing?.amount ?? next.min, submittedAt: null });
    AccessibilityInfo.announceForAccessibility(`Selected ${next.name}. Nothing placed.`);
  };

  return (
    <View style={styles.section}>
      <Row label="All wagers" hint="Back to the list of wagers. Your draft is kept." onPress={() => onDraftChange({ ...draft, kind: null })} compact>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.rowTitle}>‹ All wagers</Text>
      </Row>
      <Text ref={heading} accessibilityRole="header" maxFontSizeMultiplier={textScale.display} style={styles.editorTitle}>
        {kind.name}
      </Text>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.rowDetail}>{kind.detail}</Text>

      <Text maxFontSizeMultiplier={textScale.body} style={styles.sectionLabel}>{kind.choiceLabel}</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={`${kind.name}: ${kind.choiceLabel}`} style={styles.choices}>
        {kind.choices.map((option) => (
          <ChoiceButton key={option.target} choice={option} checked={option.target === draft.target} onPress={() => choose(option)} />
        ))}
      </View>

      {choice && (placed?.committed ? <CommittedStake wager={placed} choice={choice} /> : <StakeEditor {...props} choice={choice} canPlace={canPlace} onSet={onSet} />)}
    </View>
  );
}

function StakeEditor({ choice, draft, wagers, balance, facts, sequence, canPlace, onDraftChange, onSet }: BetSelectorProps & { choice: WagerChoice }) {
  const { focused, focusProps } = useKeyboardFocus();
  const problem = submissionProblem(draft, choice, facts, sequence, balance, wagers);
  const amount = parseStake(draft.text);
  const edit = (text: string) => onDraftChange({ ...draft, text, submittedAt: null });
  const submit = () => {
    onDraftChange({ ...draft, submittedAt: sequence });
    if (amount !== null && amount !== '0') onSet(choice.target, amount);
  };
  const step = formatUnits(choice.step);
  const setLabel = amount !== null && !amount.includes('/') ? `Set ${choice.name} to ${formatUnits(amount)}` : `Set ${choice.name}`;

  return (
    <View style={styles.group}>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.sectionLabel}>Total stake on {choice.name}</Text>
      <View style={styles.stakeRow}>
        <TextInput
          accessibilityLabel={`Total stake for ${choice.name}, in units`}
          accessibilityHint="The total for this wager, not an amount to add."
          value={draft.text}
          onChangeText={edit}
          onSubmitEditing={submit}
          inputMode="decimal"
          keyboardType="decimal-pad"
          returnKeyType="done"
          maxFontSizeMultiplier={textScale.body}
          {...focusProps}
          style={[styles.field, problem !== null && styles.fieldProblem, focused && styles.focused]}
        />
        <Text maxFontSizeMultiplier={textScale.body} style={styles.rowDetail}>units</Text>
      </View>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.rowDetail}>
        {choice.step === '1' ? 'Whole units' : `Multiples of ${step}`} · {formatUnits(choice.min)} to {formatUnits(choice.max)} · pays {choice.payout}. Enter the total, not an amount to add.
      </Text>
      {problem !== null && (
        <Text accessibilityRole="alert" maxFontSizeMultiplier={textScale.body} style={styles.problem}>
          {problem}
        </Text>
      )}
      <View style={styles.steppers}>
        <SmallButton label={`− ${step}`} spoken={`Decrease by ${step}`} onPress={() => edit(stepStake(draft.text, choice.step, -1))} />
        <SmallButton label={`+ ${step}`} spoken={`Increase by ${step}`} onPress={() => edit(stepStake(draft.text, choice.step, 1))} />
      </View>
      <Row label={setLabel} onPress={submit} disabled={!canPlace} primary compact>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.primaryLabel}>{setLabel}</Text>
      </Row>
      {isDraftPending(draft, wagers) && (
        <Text maxFontSizeMultiplier={textScale.body} style={styles.rowDetail}>{DRAFT_NOTE}</Text>
      )}
    </View>
  );
}

function CommittedStake({ wager, choice }: { wager: PlacedWager; choice: WagerChoice }) {
  return (
    <View style={styles.group}>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.sectionLabel}>Total stake on {choice.name}</Text>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.rowTitle}>{formatUnits(wager.amount)} · committed</Text>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.rowDetail}>{wager.committedReason ?? 'Committed until it settles.'}</Text>
    </View>
  );
}

function YourWagers({ catalog, wagers, canPlace, onDraftChange, onRemove }: BetSelectorProps) {
  const heading = useRef<HostInstance>(null);
  const removing = useRef<string | null>(null);
  const [explaining, setExplaining] = useState<string | null>(null);

  // Once a removed wager is gone, focus lands on the list heading rather than nowhere.
  useEffect(() => {
    if (removing.current !== null && !wagers.some((w) => w.target === removing.current)) {
      removing.current = null;
      moveFocus(heading);
    }
  }, [wagers]);

  const nameOf = (target: string) => findChoice(catalog, target)?.choice.name ?? target;
  return (
    <View testID="your-wagers" style={styles.group}>
      <Text ref={heading} testID="your-wagers-heading" accessibilityRole="header" maxFontSizeMultiplier={textScale.body} style={styles.sectionLabel}>
        Your wagers · {wagers.length}
      </Text>
      {wagers.length === 0 && (
        <Text maxFontSizeMultiplier={textScale.body} style={styles.rowDetail}>No wagers yet. Choose one above, set its stake, then spin.</Text>
      )}
      {wagers.map((wager) => {
        const name = nameOf(wager.target);
        const found = findChoice(catalog, wager.target);
        return (
          <View key={wager.target} style={styles.wager}>
            <View accessible accessibilityLabel={`${name}, ${formatUnits(wager.amount)}, ${wager.committed ? 'committed' : 'removable'}`} style={styles.wagerText}>
              <Text maxFontSizeMultiplier={textScale.body} style={styles.rowTitle}>{name}</Text>
              <Text maxFontSizeMultiplier={textScale.body} style={styles.rowTitle}>{formatUnits(wager.amount)}</Text>
              <Text maxFontSizeMultiplier={textScale.body} style={styles.tag}>{wager.committed ? 'Committed' : 'Removable'}</Text>
            </View>
            {explaining === wager.target && wager.committed && (
              <Text maxFontSizeMultiplier={textScale.body} style={styles.rowDetail}>{wager.committedReason ?? 'Committed until it settles.'}</Text>
            )}
            <View style={styles.steppers}>
              {found && (
                <SmallButton
                  label={wager.committed ? 'Inspect' : 'Edit'}
                  spoken={`${wager.committed ? 'Inspect' : 'Edit'} ${name}`}
                  onPress={() => onDraftChange({ kind: found.kind.id, target: wager.target, text: wager.amount, submittedAt: null })}
                />
              )}
              {wager.committed ? (
                <SmallButton label="Why locked?" spoken={`Why can't I change ${name}?`} onPress={() => setExplaining(wager.target)} />
              ) : (
                <SmallButton
                  label="Remove"
                  spoken={`Remove ${name}`}
                  disabled={!canPlace}
                  onPress={() => {
                    removing.current = wager.target;
                    onRemove(wager.target);
                  }}
                />
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** Why the latest submission of this draft didn't set the wager, or null. */
function submissionProblem(
  draft: BetDraft,
  choice: WagerChoice,
  facts: readonly DomainFact[],
  sequence: number,
  balance: string,
  wagers: readonly PlacedWager[],
): string | null {
  if (draft.submittedAt === null || draft.target !== choice.target) return null;
  const min = formatUnits(choice.min);
  const max = formatUnits(choice.max);
  const amount = parseStake(draft.text);
  if (amount === null) return `Enter the total stake as a number of units, from ${min} to ${max}. Your draft is kept.`;
  if (amount === '0') return `Enter at least ${min}. To take ${choice.name} down, use Remove.`;
  // Only the transition this submission produced explains it.
  if (sequence !== draft.submittedAt + 1) return null;
  const illegal = facts.find(
    (fact): fact is Extract<DomainFact, { kind: 'illegal-action' }> =>
      fact.kind === 'illegal-action' && fact.command.kind === 'place-wager' && fact.command.target === choice.target,
  );
  return illegal ? illegalExplanation(illegal.reason, choice, balance, wagers) : null;
}

function illegalExplanation(reason: IllegalActionReason, choice: WagerChoice, balance: string, wagers: readonly PlacedWager[]): string {
  const min = formatUnits(choice.min);
  const max = formatUnits(choice.max);
  switch (reason) {
    case 'not-whole-units':
      return `Use ${choice.step === '1' ? 'whole units' : `multiples of ${formatUnits(choice.step)}`}, from ${min} to ${max}. Your draft is kept and nothing on the table changed.`;
    case 'below-minimum':
      return `${choice.name} needs at least ${min}. Your draft is kept.`;
    case 'above-maximum':
      return `Over this table's maximum. ${choice.name} can be at most ${max}. Your draft is kept.`;
    case 'insufficient-funds': {
      const cap = affordableCap(choice, balance, wagers);
      return compare(decodeMoney(cap), decodeMoney(choice.min)) >= 0
        ? `More than you have. With a balance of ${formatUnits(balance)} you can set up to ${formatUnits(cap)}. Your draft is kept.`
        : `More than you have. With a balance of ${formatUnits(balance)} you can't cover the minimum of ${min}. Your draft is kept.`;
    }
    default:
      return `${choice.name} can't be set to that. Your draft is kept.`;
  }
}

/** The largest legal total for this target the balance covers: its own stake back plus the balance, capped and rounded down to the step. */
function affordableCap(choice: WagerChoice, balance: string, wagers: readonly PlacedWager[]): string {
  const available = decodeMoney(balance);
  const own = BigInt(wagers.find((w) => w.target === choice.target)?.amount ?? '0');
  const step = BigInt(choice.step);
  let units = available.n / available.d + own;
  const max = BigInt(choice.max);
  if (units > max) units = max;
  return (units - (units % step)).toString();
}

// ---- controls -------------------------------------------------------------

function Row({
  label,
  value,
  hint,
  onPress,
  disabled = false,
  primary = false,
  compact = false,
  children,
}: {
  label: string;
  value?: string;
  hint?: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
  compact?: boolean;
  children: React.ReactNode;
}) {
  const { focused, focusProps } = useKeyboardFocus();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityValue={value === undefined ? undefined : { text: value }}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      {...focusProps}
      style={({ pressed }) => [
        styles.row,
        compact && styles.rowCompact,
        primary && styles.primary,
        pressed && styles.pressed,
        disabled && styles.disabled,
        focused && styles.focused,
      ]}
    >
      {children}
    </Pressable>
  );
}

function ChoiceButton({ choice, checked, onPress }: { choice: WagerChoice; checked: boolean; onPress: () => void }) {
  const { focused, focusProps } = useKeyboardFocus();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={choice.name}
      accessibilityState={{ checked }}
      onPress={onPress}
      {...focusProps}
      style={[styles.choice, checked && styles.choiceChecked, focused && styles.focused]}
    >
      <Text maxFontSizeMultiplier={textScale.body} style={[styles.choiceText, checked && styles.choiceTextChecked]}>
        {choice.label}
      </Text>
      {checked && <Text maxFontSizeMultiplier={textScale.body} style={styles.choiceCheck}>✓</Text>}
    </Pressable>
  );
}

function SmallButton({ label, spoken, onPress, disabled = false }: { label: string; spoken: string; onPress: () => void; disabled?: boolean }) {
  const { focused, focusProps } = useKeyboardFocus();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={spoken}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      {...focusProps}
      style={({ pressed }) => [styles.small, pressed && styles.pressed, disabled && styles.disabled, focused && styles.focused]}
    >
      <Text maxFontSizeMultiplier={textScale.body} style={styles.smallText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  selector: { gap: space[4], paddingHorizontal: space[4] },
  section: { gap: space[3] },
  group: { gap: space[2] },
  sectionLabel: { fontFamily: fonts.uiBold, fontSize: 12, letterSpacing: 0.5, textTransform: 'uppercase', color: palette.mutedForeground },
  row: {
    minHeight: MIN_TOUCH_TARGET + 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space[3],
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: palette.transparent,
    backgroundColor: palette.card,
  },
  rowCompact: { minHeight: MIN_TOUCH_TARGET, alignSelf: 'flex-start' },
  rowText: { flex: 1, minWidth: 160, gap: 2 },
  rowTitle: { fontFamily: fonts.uiBold, fontSize: 15, color: palette.foreground },
  rowDetail: { fontFamily: fonts.ui, fontSize: 13, lineHeight: 18, color: palette.mutedForeground },
  rowValue: { fontFamily: fonts.uiBold, fontSize: 15, color: palette.foreground },
  editorTitle: { fontFamily: fonts.display, fontSize: 24, color: palette.foreground },
  primary: { backgroundColor: palette.primary, borderColor: palette.primary, alignSelf: 'stretch', justifyContent: 'center' },
  primaryLabel: { fontFamily: fonts.uiBold, fontSize: 16, color: palette.primaryForeground, textAlign: 'center', flexShrink: 1 },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.4 },
  focused: { borderColor: palette.ring },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  choice: {
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[1],
    paddingHorizontal: space[3],
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: palette.controlBorder,
    backgroundColor: palette.background,
  },
  choiceChecked: { borderColor: palette.primary, backgroundColor: palette.secondary },
  choiceText: { fontFamily: fonts.uiMedium, fontSize: 15, color: palette.foreground },
  choiceTextChecked: { fontFamily: fonts.uiBold },
  choiceCheck: { fontFamily: fonts.uiBold, fontSize: 13, color: palette.foreground },
  stakeRow: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  field: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: space[3],
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: palette.controlBorder,
    backgroundColor: palette.card,
    fontFamily: fonts.uiBold,
    fontSize: 18,
    color: palette.foreground,
  },
  fieldProblem: { borderColor: palette.destructive },
  problem: { fontFamily: fonts.uiMedium, fontSize: 14, lineHeight: 20, color: palette.destructive },
  steppers: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  small: {
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[4],
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: palette.secondary,
    backgroundColor: palette.secondary,
  },
  smallText: { fontFamily: fonts.uiBold, fontSize: 14, color: palette.foreground },
  wager: { gap: space[2], paddingVertical: space[2], borderBottomWidth: 1, borderBottomColor: palette.border },
  wagerText: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space[3] },
  tag: {
    fontFamily: fonts.uiBold,
    fontSize: 12,
    color: palette.foreground,
    paddingHorizontal: space[2],
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: palette.secondary,
    overflow: 'hidden',
  },
});
