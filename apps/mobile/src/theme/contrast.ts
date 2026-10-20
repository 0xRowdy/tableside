// WCAG 2.2 contrast ratio between two #RRGGBB or #RRGGBBAA colors.
// A translucent background is composited over black and over white and the
// lower ratio wins, because the backdrop (for example a photo) can be either.

type Rgb = [number, number, number];

function parse(hex: string): { rgb: Rgb; alpha: number } {
  const value = hex.replace('#', '');
  const channel = (i: number) => parseInt(value.slice(i, i + 2), 16) / 255;
  return { rgb: [channel(0), channel(2), channel(4)], alpha: value.length === 8 ? channel(6) : 1 };
}

const over = (top: Rgb, alpha: number, bottom: Rgb): Rgb =>
  [0, 1, 2].map((i) => top[i]! * alpha + bottom[i]! * (1 - alpha)) as Rgb;

function luminance([r, g, b]: Rgb): number {
  const linear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

const ratio = (a: Rgb, b: Rgb) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

export function contrastRatio(foreground: string, background: string): number {
  const fg = parse(foreground);
  const bg = parse(background);
  const backdrops: Rgb[] = bg.alpha < 1 ? [[0, 0, 0], [1, 1, 1]] : [bg.rgb];
  return Math.min(
    ...backdrops.map((backdrop) => {
      const solidBackground = over(bg.rgb, bg.alpha, backdrop);
      return ratio(over(fg.rgb, fg.alpha, solidBackground), solidBackground);
    }),
  );
}
