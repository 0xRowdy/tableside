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
