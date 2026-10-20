// The graphical roulette layout (design frames "05 Roulette — Betting" and
// "S1-04 Roulette — double-zero layout"). Outside areas take a chip with one
// tap. A number or zero opens its bet loupe: every inside placement covering
// that pocket (straight, splits, streets, trios, corners, first four, six
// lines, the five-number basket), each with its payout, so every placement on
// the layout can be reached with targets of at least 48 points. The placements
// and payouts come from the engine's permitted view; nothing here decides
// coverage or legality.

import type { PermittedView, RoulettePocket } from '@tableside/engine';
import { useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';

import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import { fonts, MIN_TOUCH_TARGET, palette, radius, space, textScale, type ColorToken } from '@/theme/tokens';

import { formatUnits, kindName, pocketColor, spokenPayout, targetName } from './roulette-text';

type Placement = PermittedView['table']['placements'][number];

const POCKET_TOKEN = { red: 'pocketRed', black: 'pocketBlack', green: 'pocketGreen' } as const;
const ROWS = Array.from({ length: 12 }, (_, row) => [row * 3 + 1, row * 3 + 2, row * 3 + 3]);
const EVEN_MONEY = [
  { target: 'low', label: '1–18' },
  { target: 'even', label: 'EVEN' },
  { target: 'red', label: 'RED' },
  { target: 'black', label: 'BLACK' },
  { target: 'odd', label: 'ODD' },
  { target: 'high', label: '19–36' },
] as const;
const COLOR_SPOTS: Partial<Record<string, ColorToken>> = { red: 'pocketRed', black: 'pocketBlack' };

export function RouletteFelt({
  view,
  canPlace,
  chip,
  wagerOn,
  onSpot,
}: {
  view: PermittedView;
  canPlace: boolean;
  chip: string;
  wagerOn: (target: string) => string | undefined;
  onSpot: (target: string) => void;
}) {
  const [open, setOpen] = useState<RoulettePocket | null>(null);
  const placement = (target: string) => view.table.placements.find((p) => p.target === target);
  const zeros: RoulettePocket[] = view.table.wheel === 'double-zero' ? [0, '00'] : [0];
  const hint = `Adds ${formatUnits(chip)}.`;

  /** An outside area; with no label, its payout is the label (the column spots read "2 to 1"). */
  const outside = (target: string, label: string | null, style: object, color: ColorToken = 'felt') => {
    const payout = placement(target)?.payout ?? '';
    return (
      <Spot
        key={target}
        label={label ?? spokenPayout(payout)}
        {...(label !== null && { caption: payout })}
        spoken={`${targetName(target)}, pays ${spokenPayout(payout)}`}
        hint={hint}
        value={wagerOn(target) ? `${formatUnits(wagerOn(target) as string)} on it` : 'no wager'}
        marker={wagerOn(target)}
        color={color}
        disabled={!canPlace}
        onPress={() => onSpot(target)}
        style={style}
      />
    );
  };

  const pocketSpot = (pocket: RoulettePocket, style?: object) => {
    const straight = wagerOn(`straight-${pocket}`);
    const others = view.wagers.filter((w) => w.target !== `straight-${pocket}` && placement(w.target)?.covers.includes(pocket)).length;
    const value = [straight ? `${formatUnits(straight)} straight up` : 'no straight-up wager', others > 0 ? `${others} other ${others === 1 ? 'bet covers' : 'bets cover'} it` : '']
      .filter(Boolean)
      .join(', ');
    const expanded = open === pocket;
    return (
      <Spot
        key={String(pocket)}
        label={String(pocket)}
        spoken={`${pocket}, ${pocketColor(pocket)}`}
        hint={expanded ? 'Hides its bets.' : `Shows every bet that covers ${pocket}.`}
        value={value}
        marker={straight}
        covered={others > 0}
        expanded={expanded}
        color={POCKET_TOKEN[pocketColor(pocket)]}
        disabled={false}
        onPress={() => {
          setOpen(expanded ? null : pocket);
          if (!expanded) AccessibilityInfo.announceForAccessibility(`Bets on ${pocket} are listed below the table.`);
        }}
        style={style}
      />
    );
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.felt} testID="felt">
        <View style={[styles.side, styles.evenMoney]}>
          {EVEN_MONEY.map(({ target, label }) => outside(target, label, styles.sideSpot, COLOR_SPOTS[target]))}
        </View>
        <View style={[styles.side, styles.dozens]}>
          {[1, 2, 3].map((d) => outside(`dozen-${d}`, `${['1st', '2nd', '3rd'][d - 1]} 12`, styles.sideSpot))}
        </View>
        <View style={styles.numbers}>
          <View style={styles.row}>{zeros.map((pocket) => pocketSpot(pocket, styles.number))}</View>
          {ROWS.map((row) => (
            <View key={row[0]} style={styles.row}>
              {row.map((n) => pocketSpot(n, styles.number))}
            </View>
          ))}
          <View style={styles.row}>{[1, 2, 3].map((c) => outside(`column-${c}`, null, styles.number))}</View>
        </View>
      </View>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.caption}>
        Tap a number for its straight-up, split, street, corner and line bets.
      </Text>
      {open !== null && (
        <Loupe
          pocket={open}
          placements={view.table.placements.filter((p) => p.limitClass === 'inside' && p.covers.includes(open))}
          canPlace={canPlace}
          hint={hint}
          wagerOn={wagerOn}
          onSpot={onSpot}
          onClose={() => setOpen(null)}
        />
      )}
    </View>
  );
}

function Loupe({
  pocket,
  placements,
  canPlace,
  hint,
  wagerOn,
  onSpot,
  onClose,
}: {
  pocket: RoulettePocket;
  placements: readonly Placement[];
  canPlace: boolean;
  hint: string;
  wagerOn: (target: string) => string | undefined;
  onSpot: (target: string) => void;
  onClose: () => void;
}) {
  const close = useKeyboardFocus();
  return (
    <View style={styles.loupe} testID="bet-loupe">
      <View style={styles.loupeHead}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.display} style={styles.loupeTitle}>
          Bets on {pocket}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Close bets on ${pocket}`}
          onPress={onClose}
          {...close.focusProps}
          style={[styles.close, close.focused && styles.focused]}
        >
          <Text maxFontSizeMultiplier={textScale.body} style={styles.closeText}>Close</Text>
        </Pressable>
      </View>
      <View style={styles.loupeRows}>
        {placements.map((p) => (
          <LoupeRow key={p.target} placement={p} wager={wagerOn(p.target)} canPlace={canPlace} hint={hint} onPress={() => onSpot(p.target)} />
        ))}
      </View>
    </View>
  );
}

function LoupeRow({
  placement,
  wager,
  canPlace,
  hint,
  onPress,
}: {
  placement: Placement;
  wager: string | undefined;
  canPlace: boolean;
  hint: string;
  onPress: () => void;
}) {
  const { focused, focusProps } = useKeyboardFocus();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${targetName(placement.target)}, pays ${spokenPayout(placement.payout)}`}
      accessibilityHint={hint}
      accessibilityValue={{ text: wager ? `${formatUnits(wager)} on it` : 'no wager' }}
      accessibilityState={{ disabled: !canPlace }}
      disabled={!canPlace}
      onPress={onPress}
      {...focusProps}
      style={[styles.loupeRow, wager !== undefined && styles.loupeRowWagered, focused && styles.focused]}
    >
      <Text maxFontSizeMultiplier={textScale.body} style={styles.loupeRowTitle}>
        {placement.covers.join(' · ')}
        {wager !== undefined && `  · ${formatUnits(wager)}`}
      </Text>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.loupeRowPayout}>
        {kindName(placement.kind)} {placement.payout}
      </Text>
    </Pressable>
  );
}

function Spot({
  label,
  caption,
  spoken,
  hint,
  value,
  marker,
  covered = false,
  expanded,
  color,
  disabled,
  onPress,
  style,
}: {
  label: string;
  caption?: string;
  spoken: string;
  hint: string;
  value: string;
  marker: string | undefined;
  covered?: boolean;
  expanded?: boolean;
  color: ColorToken;
  disabled: boolean;
  onPress: () => void;
  style?: object | undefined;
}) {
  const { focused, focusProps } = useKeyboardFocus();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={spoken}
      accessibilityHint={hint}
      accessibilityValue={{ text: value }}
      accessibilityState={expanded === undefined ? { disabled } : { disabled, expanded }}
      disabled={disabled}
      onPress={onPress}
      {...focusProps}
      style={[
        styles.spot,
        { backgroundColor: palette[color] },
        (marker !== undefined || covered || expanded) && styles.spotMarked,
        focused && styles.focused,
        style,
      ]}
    >
      <Text maxFontSizeMultiplier={textScale.body} style={styles.spotText}>{label}</Text>
      {caption !== undefined && <Text maxFontSizeMultiplier={textScale.body} style={styles.spotCaption}>{caption}</Text>}
      {marker !== undefined && (
        <View style={styles.marker}>
          <Text maxFontSizeMultiplier={textScale.body} style={styles.markerText}>{formatUnits(marker)}</Text>
        </View>
      )}
      {/* Another bet covers this pocket: marked by a symbol, not only the outline. */}
      {marker === undefined && covered && <Text maxFontSizeMultiplier={textScale.body} style={styles.spotCaption}>{'•'}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[2] },
  felt: { flexDirection: 'row', gap: 2, padding: space[3], marginHorizontal: space[2], borderRadius: radius.lg, backgroundColor: palette.feltDeep },
  // The side columns line up with the twelve number rows, between the zero and column rows.
  side: { gap: 2, paddingVertical: MIN_TOUCH_TARGET + 2 },
  evenMoney: { width: 56 },
  dozens: { width: MIN_TOUCH_TARGET },
  sideSpot: { flex: 1 },
  numbers: { flex: 1, gap: 2 },
  row: { flexDirection: 'row', gap: 2 },
  number: { flex: 1 },
  spot: {
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: palette.transparent,
  },
  spotMarked: { borderColor: palette.foreground },
  focused: { borderColor: palette.ring },
  spotText: { fontFamily: fonts.uiBold, fontSize: 14, color: palette.onImage, textAlign: 'center' },
  spotCaption: { fontFamily: fonts.uiMedium, fontSize: 10, color: palette.onImage, textAlign: 'center' },
  marker: { marginTop: 2, minWidth: 26, paddingHorizontal: 4, borderRadius: radius.pill, backgroundColor: palette.chip1, alignItems: 'center' },
  markerText: { fontFamily: fonts.uiBold, fontSize: 11, color: palette.ink },
  caption: { marginHorizontal: space[4], fontFamily: fonts.ui, fontSize: 12, color: palette.mutedForeground },
  loupe: { marginHorizontal: space[2], padding: space[3], gap: space[2], borderRadius: radius.lg, backgroundColor: palette.popover },
  loupeHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2] },
  loupeTitle: { flex: 1, fontFamily: fonts.uiBold, fontSize: 16, color: palette.foreground },
  close: {
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    paddingHorizontal: space[3],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: palette.controlBorder,
  },
  closeText: { fontFamily: fonts.uiMedium, fontSize: 14, color: palette.foreground },
  loupeRows: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  loupeRow: {
    flexGrow: 1,
    flexBasis: 140,
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: space[3],
    paddingVertical: space[1],
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: palette.controlBorder,
  },
  loupeRowWagered: { borderColor: palette.foreground },
  loupeRowTitle: { fontFamily: fonts.uiBold, fontSize: 14, color: palette.foreground },
  loupeRowPayout: { fontFamily: fonts.ui, fontSize: 12, color: palette.mutedForeground },
});
