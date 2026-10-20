// Tableside design tokens, from the "Design System — Tableside" variables in
// design/Tableside.pen. The app is dark-only for launch; every color is named
// here so a light theme can be added later by supplying another palette.

export const palette = {
  background: '#0E1311',
  foreground: '#F3EFE6',
  card: '#161D1A',
  mutedForeground: '#A9B2AC',
  border: '#2C3832',
  controlBorder: '#6E7B74',
  primary: '#D4AE62',
  primaryForeground: '#1A1406',
  secondary: '#26312C',
  ring: '#D4AE62',
  onImage: '#FFFFFF',
  scrim: '#000000B3',
  transparent: '#00000000',
  popover: '#1B2420',
  muted: '#1E2723',
  correct: '#3FA877',
  destructive: '#E07A5F',
  felt: '#1B5A43',
  feltDeep: '#123F2F',
  rail: '#3A2A1E',
  ink: '#1E1A14',
  chip1: '#EDE7D8',
  chip5: '#B83A33',
  chip25: '#2E7D4F',
  chip100: '#1D1F22',
  chip500: '#6A3FA0',
  chip1k: '#D99A2B',
  // Wheel pockets share the chip hues in the design, but are their own tokens.
  pocketRed: '#B83A33',
  pocketBlack: '#1D1F22',
  pocketGreen: '#2E7D4F',
  // Playing cards: a light face with four-colour suits, so suits differ by glyph and colour.
  cardFace: '#FBF8F1',
  suitSpade: '#15171A',
  suitHeart: '#C8312F',
  suitDiamond: '#1F5FBF',
  suitClub: '#1C7A3E',
  feltText: '#F1EAD6',
} as const;

export type ColorToken = keyof typeof palette;

/**
 * Foreground/background pairs that carry essential information, with the
 * contrast each must meet: 4.5:1 for text, 3:1 for graphics and control
 * boundaries. The contrast test checks every pair; add a pair when a component
 * starts relying on one.
 */
export const essentialPairs: readonly {
  use: string;
  kind: 'text' | 'graphic';
  foreground: ColorToken;
  background: ColorToken;
}[] = [
  { use: 'body text', kind: 'text', foreground: 'foreground', background: 'background' },
  { use: 'secondary text', kind: 'text', foreground: 'mutedForeground', background: 'background' },
  { use: 'tab label', kind: 'text', foreground: 'mutedForeground', background: 'card' },
  { use: 'selected tab label', kind: 'text', foreground: 'foreground', background: 'card' },
  { use: 'selected tab label on its pill', kind: 'text', foreground: 'foreground', background: 'secondary' },
  { use: 'tab icon', kind: 'graphic', foreground: 'mutedForeground', background: 'card' },
  { use: 'selected tab icon', kind: 'graphic', foreground: 'primary', background: 'secondary' },
  { use: 'selected tab outline', kind: 'graphic', foreground: 'primary', background: 'card' },
  { use: 'focus ring', kind: 'graphic', foreground: 'ring', background: 'card' },
  { use: 'focus ring on screens', kind: 'graphic', foreground: 'ring', background: 'background' },
  { use: 'control boundary', kind: 'graphic', foreground: 'controlBorder', background: 'background' },
  { use: 'primary button label', kind: 'text', foreground: 'primaryForeground', background: 'primary' },
  { use: 'primary button on screens', kind: 'graphic', foreground: 'primary', background: 'background' },
  { use: 'game card text on its scrim band', kind: 'text', foreground: 'onImage', background: 'scrim' },
  { use: 'session strip and result card text', kind: 'text', foreground: 'foreground', background: 'card' },
  { use: 'session strip labels', kind: 'text', foreground: 'mutedForeground', background: 'card' },
  { use: 'status tag and secondary button label', kind: 'text', foreground: 'foreground', background: 'secondary' },
  { use: 'dialog text', kind: 'text', foreground: 'foreground', background: 'popover' },
  { use: 'dialog secondary text', kind: 'text', foreground: 'mutedForeground', background: 'popover' },
  { use: 'error text', kind: 'text', foreground: 'destructive', background: 'background' },
  { use: 'error text in a sheet', kind: 'text', foreground: 'destructive', background: 'popover' },
  { use: 'sheet field boundary', kind: 'graphic', foreground: 'controlBorder', background: 'popover' },
  { use: 'sheet error field boundary', kind: 'graphic', foreground: 'destructive', background: 'popover' },
  { use: 'sheet icon', kind: 'graphic', foreground: 'foreground', background: 'popover' },
  { use: 'sheet focus ring', kind: 'graphic', foreground: 'ring', background: 'popover' },
  { use: 'saved banner icon', kind: 'graphic', foreground: 'correct', background: 'card' },
  { use: 'red pocket number', kind: 'text', foreground: 'onImage', background: 'pocketRed' },
  { use: 'black pocket number', kind: 'text', foreground: 'onImage', background: 'pocketBlack' },
  { use: 'zero pocket number', kind: 'text', foreground: 'onImage', background: 'pocketGreen' },
  { use: 'wagered spot outline on a red pocket', kind: 'graphic', foreground: 'foreground', background: 'pocketRed' },
  { use: 'wagered spot outline on a black pocket', kind: 'graphic', foreground: 'foreground', background: 'pocketBlack' },
  { use: 'wagered spot outline on the zero pocket', kind: 'graphic', foreground: 'foreground', background: 'pocketGreen' },
  { use: 'focused spot or chip ring on the felt', kind: 'graphic', foreground: 'ring', background: 'feltDeep' },
  { use: 'outside spot label and payout on the felt', kind: 'text', foreground: 'onImage', background: 'felt' },
  { use: 'wagered outside spot outline on the felt', kind: 'graphic', foreground: 'foreground', background: 'felt' },
  { use: 'selected wheel choice outline', kind: 'graphic', foreground: 'primary', background: 'card' },
  { use: 'focused chip ring on the rail', kind: 'graphic', foreground: 'ring', background: 'rail' },
  { use: 'chip rack caption', kind: 'text', foreground: 'foreground', background: 'rail' },
  { use: 'buy-in field boundary', kind: 'graphic', foreground: 'controlBorder', background: 'card' },
  { use: 'error field boundary and banner border', kind: 'graphic', foreground: 'destructive', background: 'card' },
  { use: 'wager marker on the felt', kind: 'text', foreground: 'ink', background: 'chip1' },
  { use: '1 chip value', kind: 'text', foreground: 'ink', background: 'chip1' },
  { use: '5 chip value', kind: 'text', foreground: 'onImage', background: 'chip5' },
  { use: '25 chip value', kind: 'text', foreground: 'onImage', background: 'chip25' },
  { use: '100 chip value', kind: 'text', foreground: 'onImage', background: 'chip100' },
  { use: '500 chip value', kind: 'text', foreground: 'onImage', background: 'chip500' },
  { use: '1K chip value', kind: 'text', foreground: 'ink', background: 'chip1k' },
  { use: 'selected chip ring on the rail', kind: 'graphic', foreground: 'primary', background: 'rail' },
  { use: 'spade rank and pip', kind: 'text', foreground: 'suitSpade', background: 'cardFace' },
  { use: 'heart rank and pip', kind: 'text', foreground: 'suitHeart', background: 'cardFace' },
  { use: 'diamond rank and pip', kind: 'text', foreground: 'suitDiamond', background: 'cardFace' },
  { use: 'club rank and pip', kind: 'text', foreground: 'suitClub', background: 'cardFace' },
  { use: 'card edge on the felt', kind: 'graphic', foreground: 'cardFace', background: 'felt' },
  { use: 'felt labels', kind: 'text', foreground: 'feltText', background: 'felt' },
  { use: 'shoe count, hand totals and bet spot text', kind: 'text', foreground: 'feltText', background: 'feltDeep' },
  { use: 'bet spot boundary', kind: 'graphic', foreground: 'feltText', background: 'felt' },
  { use: 'wagered bet spot outline', kind: 'graphic', foreground: 'cardFace', background: 'feltDeep' },
  { use: 'focused control ring on the felt', kind: 'graphic', foreground: 'ring', background: 'felt' },
  { use: 'volume fill and switch on', kind: 'graphic', foreground: 'primary', background: 'card' },
  { use: 'volume thumb', kind: 'graphic', foreground: 'foreground', background: 'card' },
  { use: 'switch knob when off', kind: 'graphic', foreground: 'mutedForeground', background: 'muted' },
  { use: 'switch knob when on', kind: 'graphic', foreground: 'primaryForeground', background: 'primary' },
  { use: 'check mark on the switch knob', kind: 'graphic', foreground: 'primary', background: 'primaryForeground' },
  { use: 'volume button icon', kind: 'graphic', foreground: 'foreground', background: 'secondary' },
];

export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 6: 24, 8: 32, 12: 48, 16: 64 } as const;
export const radius = { sm: 6, md: 10, lg: 16, card: 20, pill: 999 } as const;

/** Font family names as loaded in the root layout. */
export const fonts = {
  display: 'Fraunces_400Regular',
  ui: 'Inter_400Regular',
  uiMedium: 'Inter_500Medium',
  uiBold: 'Inter_700Bold',
} as const;

/**
 * How far text may grow with system text size, from the design's largest-text
 * frames. Display headings stop at 1.5× so words don't break; body text reaches
 * 2× and reflows. Tab labels don't scale at all (see TabBar).
 */
export const textScale = { display: 1.5, body: 2 } as const;

/** Minimum touch target: 44 pt on iOS, 48 dp on Android. The larger serves both. */
export const MIN_TOUCH_TARGET = 48;
