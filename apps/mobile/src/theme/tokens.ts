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
  warning: '#E8A23A',
  info: '#7FA8F5',
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
  pocketRed: '#B83A33',
  pocketBlack: '#1D1F22',
  pocketGreen: '#2E7D4F',
  cardFace: '#FBF8F1',
  suitSpade: '#15171A',
  suitHeart: '#C8312F',
  suitDiamond: '#1F5FBF',
  suitClub: '#1C7A3E',
  feltText: '#F1EAD6',
  coach: '#F6F1E4',
  coachAccent: '#2563C8',
  inkMuted: '#5E574B',
  mistake: '#E07A5F',
  mistakeInk: '#B4472C',
  // docs/decisions/press-feedback.md
  primaryPressed: '#B08B45',
  coachPressed: '#E8E0CC',
  inkPressed: '#3A332A',
  pressShade: '#00000059',
} as const;

export type ColorToken = keyof typeof palette;

// Spec 3 Information hiding (end to end); Design conflicts › Frames consulted
export const FEEDBACK_TOKENS: readonly ColorToken[] = ['coach', 'coachAccent', 'correct', 'mistake', 'mistakeInk'];

// docs/development.md Accessibility notes for the shell
export const essentialPairs: readonly {
  use: string;
  kind: 'text' | 'graphic';
  foreground: ColorToken;
  background: ColorToken;
  underPressShade?: true;
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
  { use: 'Delete account row title', kind: 'text', foreground: 'destructive', background: 'card' },
  { use: 'Delete account row icon', kind: 'graphic', foreground: 'destructive', background: 'secondary' },
  { use: 'locked-state icon', kind: 'graphic', foreground: 'mutedForeground', background: 'secondary' },
  { use: 'sheet field boundary', kind: 'graphic', foreground: 'controlBorder', background: 'popover' },
  { use: 'sheet error field boundary', kind: 'graphic', foreground: 'destructive', background: 'popover' },
  { use: 'sheet icon', kind: 'graphic', foreground: 'foreground', background: 'popover' },
  { use: 'sheet focus ring', kind: 'graphic', foreground: 'ring', background: 'popover' },
  { use: 'saved banner icon', kind: 'graphic', foreground: 'correct', background: 'card' },
  { use: 'quarantined banner icon', kind: 'graphic', foreground: 'destructive', background: 'card' },
  { use: 'incomplete session banner border and icon', kind: 'graphic', foreground: 'primary', background: 'card' },
  { use: 'incomplete session "What happened?" link', kind: 'text', foreground: 'primary', background: 'card' },
  { use: 'departure resolution tag', kind: 'text', foreground: 'foreground', background: 'secondary' },
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
  { use: 'craps spot and box labels', kind: 'text', foreground: 'onImage', background: 'felt' },
  { use: 'craps roll and puck text on the felt', kind: 'text', foreground: 'onImage', background: 'feltDeep' },
  { use: 'wagered craps spot and point box outline', kind: 'graphic', foreground: 'foreground', background: 'feltDeep' },
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
  { use: 'coach note text', kind: 'text', foreground: 'ink', background: 'coach' },
  { use: 'coach note detail', kind: 'text', foreground: 'inkMuted', background: 'coach' },
  { use: 'coach note wrong-answer label and icon', kind: 'text', foreground: 'mistakeInk', background: 'coach' },
  { use: 'coach note primary action', kind: 'text', foreground: 'coach', background: 'ink' },
  { use: 'coach note outline', kind: 'graphic', foreground: 'coachAccent', background: 'background' },
  { use: 'answer choice text', kind: 'text', foreground: 'foreground', background: 'secondary' },
  { use: 'correct answer tag and outline', kind: 'text', foreground: 'correct', background: 'secondary' },
  { use: 'your wrong answer tag and outline', kind: 'text', foreground: 'mistake', background: 'secondary' },
  { use: 'challenge progress fill', kind: 'graphic', foreground: 'primary', background: 'muted' },
  { use: 'volume thumb', kind: 'graphic', foreground: 'foreground', background: 'card' },
  { use: 'switch knob when off', kind: 'graphic', foreground: 'mutedForeground', background: 'muted' },
  { use: 'this device badge on Devices', kind: 'text', foreground: 'mutedForeground', background: 'muted' },
  { use: 'switch knob when on', kind: 'graphic', foreground: 'primaryForeground', background: 'primary' },
  { use: 'check mark on the switch knob', kind: 'graphic', foreground: 'primary', background: 'primaryForeground' },
  { use: 'volume button icon', kind: 'graphic', foreground: 'foreground', background: 'secondary' },
  { use: 'first-run link text', kind: 'text', foreground: 'primary', background: 'background' },
  { use: 'first-run choice text', kind: 'text', foreground: 'foreground', background: 'card' },
  { use: 'first-run choice detail', kind: 'text', foreground: 'mutedForeground', background: 'card' },
  { use: 'sync waiting icon, warning banner border and last sign-in method lock', kind: 'graphic', foreground: 'warning', background: 'card' },
  { use: 'sync waiting icon on its circle', kind: 'graphic', foreground: 'warning', background: 'secondary' },
  { use: 'sync download icon on its circle', kind: 'graphic', foreground: 'info', background: 'secondary' },
  { use: 'sync error icon on its circle', kind: 'graphic', foreground: 'destructive', background: 'secondary' },
  { use: 'all synced icon on its circle', kind: 'graphic', foreground: 'correct', background: 'secondary' },
  { use: 'failing record label', kind: 'text', foreground: 'destructive', background: 'card' },
  { use: 'banner action', kind: 'text', foreground: 'primary', background: 'card' },
  { use: 'progress fill on its track', kind: 'graphic', foreground: 'primary', background: 'muted' },
  { use: 'selected text size option detail', kind: 'text', foreground: 'mutedForeground', background: 'secondary' },
  { use: 'selected text size option outline and icon', kind: 'graphic', foreground: 'primary', background: 'secondary' },
  { use: 'Home Community button label and icon', kind: 'text', foreground: 'foreground', background: 'secondary' },
  // docs/decisions/press-feedback.md
  { use: 'pressed primary button label', kind: 'text', foreground: 'primaryForeground', background: 'primaryPressed' },
  { use: 'pressed primary button on screens', kind: 'graphic', foreground: 'primaryPressed', background: 'background' },
  { use: 'pressed primary button on a card', kind: 'graphic', foreground: 'primaryPressed', background: 'card' },
  { use: 'pressed control label', kind: 'text', foreground: 'foreground', background: 'muted' },
  { use: 'pressed control focus ring', kind: 'graphic', foreground: 'ring', background: 'muted' },
  { use: 'pressed coach note primary action', kind: 'text', foreground: 'coach', background: 'inkPressed' },
  { use: 'pressed coach note outline action', kind: 'text', foreground: 'ink', background: 'coachPressed' },
  { use: 'pressed coach note outline edge', kind: 'graphic', foreground: 'inkMuted', background: 'coachPressed' },
  { use: 'pressed coach note focus border', kind: 'graphic', foreground: 'coachAccent', background: 'coachPressed' },
  { use: 'pressed bet spot text and boundary', kind: 'text', foreground: 'feltText', background: 'feltDeep', underPressShade: true },
  { use: 'pressed craps spot label', kind: 'text', foreground: 'onImage', background: 'felt', underPressShade: true },
  { use: 'pressed red pocket number', kind: 'text', foreground: 'onImage', background: 'pocketRed', underPressShade: true },
  { use: 'pressed black pocket number', kind: 'text', foreground: 'onImage', background: 'pocketBlack', underPressShade: true },
  { use: 'pressed zero pocket number', kind: 'text', foreground: 'onImage', background: 'pocketGreen', underPressShade: true },
  { use: 'focused control ring on pressed felt', kind: 'graphic', foreground: 'ring', background: 'felt', underPressShade: true },
  { use: 'focused chip ring on a pressed slot', kind: 'graphic', foreground: 'ring', background: 'rail', underPressShade: true },
  { use: 'milestone seal rim and flag', kind: 'graphic', foreground: 'primaryForeground', background: 'primary' },
  { use: 'milestone seal on its panel', kind: 'graphic', foreground: 'primary', background: 'popover' },
  { use: 'milestone panel text', kind: 'text', foreground: 'foreground', background: 'popover' },
  { use: 'milestone pill edge on its panel', kind: 'graphic', foreground: 'controlBorder', background: 'popover' },
];

export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 6: 24, 8: 32, 12: 48, 16: 64 } as const;
export const radius = { sm: 6, md: 10, lg: 16, card: 20, pill: 999 } as const;

export const fonts = {
  display: 'Fraunces_400Regular',
  ui: 'Inter_400Regular',
  uiMedium: 'Inter_500Medium',
  uiSemiBold: 'Inter_600SemiBold',
  uiBold: 'Inter_700Bold',
} as const;

export const textScale = { display: 1.5, body: 2 } as const;

// docs/decisions/text-size-type-floor.md; design/Tableside.pen --text-* (bi8Au)
export const TEXT_STEPS = ['standard', 'large', 'larger'] as const;
export type TextStep = (typeof TEXT_STEPS)[number];

export type TypeRole = 'tab' | 'caption' | 'label' | 'secondary' | 'body' | 'heading' | 'key' | 'headline' | 'display' | 'displayCard' | 'figure';

export const typeRamp: Readonly<Record<TextStep, Readonly<Record<TypeRole, number>>>> = {
  standard: { tab: 12, caption: 12, label: 13, secondary: 15, body: 17, heading: 20, key: 24, headline: 24, display: 32, displayCard: 36, figure: 36 },
  large: { tab: 12, caption: 14, label: 15, secondary: 17, body: 19, heading: 22, key: 26, headline: 27, display: 36, displayCard: 40, figure: 40 },
  larger: { tab: 12, caption: 15, label: 16, secondary: 19, body: 21, heading: 25, key: 28, headline: 30, display: 40, displayCard: 44, figure: 44 },
};

export const typeLeading: Readonly<Record<TypeRole, number>> = {
  tab: 1.2,
  caption: 1.35,
  label: 1.3,
  secondary: 1.4,
  body: 1.4,
  heading: 1.25,
  key: 1.15,
  headline: 1.2,
  display: 1.15,
  displayCard: 1.1,
  figure: 1.1,
};

export const SERIF_ROLES: ReadonlySet<TypeRole> = new Set(['headline', 'display', 'displayCard']);

// Spec 3 Amendment 6 §1
export const objectType = {
  card: { rank: 20, suit: 15, pip: 30 },
  largeCard: { rank: 40, suit: 28, pip: 60 },
  splitCard: { rank: 15, pip: 18 },
  chipValue: 16,
  feltPrint: 18,
} as const;

// docs/decisions/mobile-device-support-accessibility.md Q1–Q9
export const MIN_TOUCH_TARGET = 48;
