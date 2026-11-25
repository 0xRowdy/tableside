import { composite, contrastRatio } from '@/theme/contrast';
import { essentialPairs, palette } from '@/theme/tokens';

describe('contrastRatio', () => {
  it.each([
    ['#000000', '#FFFFFF', 21],
    ['#FFFFFF', '#FFFFFF', 1],
    ['#777777', '#FFFFFF', 4.48],
    ['#0000FF', '#FFFFFF', 8.59],
  ])('%s on %s is %d:1', (fg, bg, expected) => {
    expect(contrastRatio(fg, bg)).toBeCloseTo(expected, 2);
  });

  it('lays a translucent color over a solid one', () => {
    expect(composite('#00000080', '#FFFFFF')).toBe('#7F7F7F');
    expect(composite('#B83A33', '#0E1311')).toBe('#B83A33');
  });

  it('judges a translucent background by the worst backdrop it can sit on', () => {
    expect(contrastRatio('#FFFFFF', '#000000B3')).toBeCloseTo(8.59, 1);
  });
});

describe('Tableside color tokens', () => {
  it.each(essentialPairs.map((pair) => [pair.use, pair] as const))('%s meets its minimum contrast', (_use, pair) => {
    const minimum = pair.kind === 'text' ? 4.5 : 3;
    const background = pair.underPressShade ? composite(palette.pressShade, palette[pair.background]) : palette[pair.background];
    expect(contrastRatio(palette[pair.foreground], background)).toBeGreaterThanOrEqual(minimum);
  });
});
