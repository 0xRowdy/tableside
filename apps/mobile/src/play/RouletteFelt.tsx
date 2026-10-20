// The graphical roulette layout (design frames "05 Roulette — Betting" and
// "S1-04 Roulette — double-zero layout"). Every spot takes the selected chip
// with one tap: the numbers and zeros straight up, the outside areas at their
// payouts. Splits, streets, corners, lines and the zero bets are placed from
// the bet selector, whose "Find by number" lists every bet covering a number.
// Placements and payouts come from the engine's permitted view; nothing here
// decides coverage or legality.

import type { RoulettePermittedView as PermittedView, RoulettePocket } from '@tableside/engine';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';

import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import { fonts, MIN_TOUCH_TARGET, palette, radius, space, textScale, type ColorToken } from '@/theme/tokens';

import { formatUnits, ORDINAL, POCKET_TOKEN, pocketColor, spokenPayout, targetName, wheelZeros } from './roulette-text';

const ROW_GAP = 2;
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
  // The side columns line up with the twelve number rows, between the zero row
  // and the column row, whatever height larger text gives those rows.
  const [edges, setEdges] = useState({ top: MIN_TOUCH_TARGET, bottom: MIN_TOUCH_TARGET });
  const measure = (edge: 'top' | 'bottom') => (event: LayoutChangeEvent) => {
    const height = event.nativeEvent.layout.height;
    setEdges((current) => (current[edge] === height ? current : { ...current, [edge]: height }));
  };
  const side = { paddingTop: edges.top + ROW_GAP, paddingBottom: edges.bottom + ROW_GAP };
  const placement = (target: string) => view.table.placements.find((p) => p.target === target);
  const hint = `Adds ${formatUnits(chip)}.`;

  /** An outside area; with no label, its payout is the label (the column spots read "2 to 1"). */
  const outside = (target: string, label: string | null, style: StyleProp<ViewStyle>, color: ColorToken = 'felt') => {
    const payout = placement(target)?.payout ?? '';
    const wager = wagerOn(target);
    return (
      <Spot
        key={target}
        label={label ?? spokenPayout(payout)}
        {...(label !== null && { caption: payout })}
        spoken={`${targetName(target)}, pays ${spokenPayout(payout)}`}
        hint={hint}
        value={wager ? `${formatUnits(wager)} on it` : 'no wager'}
        marker={wager}
        color={color}
        disabled={!canPlace}
        onPress={() => onSpot(target)}
        style={style}
      />
    );
  };

  /** A number or zero, straight up; its value also says when other bets cover it. */
  const pocketSpot = (pocket: RoulettePocket, style: StyleProp<ViewStyle>) => {
    const target = `straight-${pocket}`;
    const straight = wagerOn(target);
    const others = view.wagers.filter((w) => w.target !== target && placement(w.target)?.covers.includes(pocket)).length;
    const value = [straight ? `${formatUnits(straight)} on it` : 'no wager', others > 0 ? `${others} other ${others === 1 ? 'bet covers' : 'bets cover'} it` : '']
      .filter(Boolean)
      .join(', ');
    return (
      <Spot
        key={target}
        label={String(pocket)}
        spoken={`Straight ${pocket}, ${pocketColor(pocket)}, pays ${spokenPayout(placement(target)?.payout ?? '')}`}
        hint={hint}
        value={value}
        marker={straight}
        covered={others > 0}
        color={POCKET_TOKEN[pocketColor(pocket)]}
        disabled={!canPlace}
        onPress={() => onSpot(target)}
        style={style}
      />
    );
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.felt} testID="felt">
        <View style={[styles.side, side, styles.evenMoney]}>
          {EVEN_MONEY.map(({ target, label }) => outside(target, label, styles.sideSpot, COLOR_SPOTS[target]))}
        </View>
        <View style={[styles.side, side, styles.dozens]}>
          {[1, 2, 3].map((d) => outside(`dozen-${d}`, `${ORDINAL[d - 1]} 12`, styles.sideSpot))}
        </View>
        <View style={styles.numbers}>
          <View style={styles.row} onLayout={measure('top')}>{wheelZeros(view.table.wheel).map((pocket) => pocketSpot(pocket, styles.number))}</View>
          {ROWS.map((row) => (
            <View key={row[0]} style={styles.row}>
              {row.map((n) => pocketSpot(n, styles.number))}
            </View>
          ))}
          <View style={styles.row} onLayout={measure('bottom')}>{[1, 2, 3].map((c) => outside(`column-${c}`, null, styles.number))}</View>
        </View>
      </View>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.caption}>
        Numbers pay 35:1 straight up. For splits, streets, corners and lines, use Bet list › Find by number.
      </Text>
    </View>
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
  color: ColorToken;
  disabled: boolean;
  onPress: () => void;
  style: StyleProp<ViewStyle>;
}) {
  const { focused, focusProps } = useKeyboardFocus();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={spoken}
      accessibilityHint={hint}
      accessibilityValue={{ text: value }}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      {...focusProps}
      style={[styles.spot, { backgroundColor: palette[color] }, (marker !== undefined || covered) && styles.spotMarked, focused && styles.focused, style]}
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
  side: { gap: ROW_GAP },
  evenMoney: { width: 56 },
  dozens: { width: MIN_TOUCH_TARGET },
  sideSpot: { flex: 1 },
  numbers: { flex: 1, gap: ROW_GAP },
  row: { flexDirection: 'row', gap: ROW_GAP },
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
});
