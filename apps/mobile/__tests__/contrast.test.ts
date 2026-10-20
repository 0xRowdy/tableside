import { contrastRatio } from '@/theme/contrast';
import { essentialPairs, palette } from '@/theme/tokens';

describe('contrastRatio', () => {
  it.each([
    ['#000000', '#FFFFFF', 21],
    ['#FFFFFF', '#FFFFFF', 1],
    ['#777777', '#FFFFFF', 4.48], // WCAG's classic "just fails AA" grey
    ['#0000FF', '#FFFFFF', 8.59],
  ])('%s on %s is %d:1', (fg, bg, expected) => {
    expect(contrastRatio(fg, bg)).toBeCloseTo(expected, 2);
  });

  it('judges a translucent background by the worst backdrop it can sit on', () => {
    // #000000B3 (179/255 black) over a white photo is #4C4C4C; white text on it is 8.59:1.
    expect(contrastRatio('#FFFFFF', '#000000B3')).toBeCloseTo(8.59, 1);
  });
});

describe('Tableside color tokens', () => {
  it.each(essentialPairs.map((pair) => [pair.use, pair] as const))('%s meets its minimum contrast', (_use, pair) => {
    const minimum = pair.kind === 'text' ? 4.5 : 3;
    expect(contrastRatio(palette[pair.foreground], palette[pair.background])).toBeGreaterThanOrEqual(minimum);
  });
});
