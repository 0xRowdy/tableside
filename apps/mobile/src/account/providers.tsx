// Spec 2 S2-13

import type { IdentityProvider } from '@tableside/account';
import { Apple, type LucideProps } from 'lucide-react-native';
import Svg, { Circle, Line } from 'react-native-svg';

function ChromeGlyph({ color = 'currentColor', size = 24, strokeWidth = 2 }: LucideProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="12" cy="12" r="10" />
      <Circle cx="12" cy="12" r="4" />
      <Line x1="21.17" x2="12" y1="8" y2="8" />
      <Line x1="3.95" x2="8.54" y1="6.06" y2="14" />
      <Line x1="10.88" x2="15.46" y1="21.94" y2="14" />
    </Svg>
  );
}

export interface ProviderDisplay {
  readonly name: string;
  readonly identity: string;
  readonly icon: (props: LucideProps) => React.ReactNode;
}

export const PROVIDERS: Readonly<Record<IdentityProvider, ProviderDisplay>> = {
  apple: { name: 'Apple', identity: 'Apple ID', icon: Apple },
  google: { name: 'Google', identity: 'Google account', icon: ChromeGlyph },
};
