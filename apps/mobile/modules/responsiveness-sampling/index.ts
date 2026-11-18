// Spec 1 Launch gates 5; #121; docs/development.md Responsiveness sampling
import { requireNativeModule } from 'expo';

export interface ResponsivenessSamplingNative {
  now(): number;
  processStart(): number | null;
  nextFrame(): Promise<number>;
  exportUri(): string;
  append(text: string): Promise<void>;
  abi(): string;
  build(): string;
}

export const responsivenessSampling = (): ResponsivenessSamplingNative => requireNativeModule<ResponsivenessSamplingNative>('ResponsivenessSampling');
