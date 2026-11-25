type Rgb = [number, number, number];

function parse(hex: string): { rgb: Rgb; alpha: number } {
  const value = hex.replace('#', '');
  const channel = (i: number) => parseInt(value.slice(i, i + 2), 16) / 255;
  return { rgb: [channel(0), channel(2), channel(4)], alpha: value.length === 8 ? channel(6) : 1 };
}

const over = (top: Rgb, alpha: number, bottom: Rgb): Rgb =>
  [0, 1, 2].map((i) => top[i]! * alpha + bottom[i]! * (1 - alpha)) as Rgb;

const hex = (rgb: Rgb) => `#${rgb.map((c) => Math.round(c * 255).toString(16).padStart(2, '0').toUpperCase()).join('')}`;

export function composite(top: string, bottom: string): string {
  const upper = parse(top);
  return hex(over(upper.rgb, upper.alpha, parse(bottom).rgb));
}

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
