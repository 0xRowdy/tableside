// Spec 1 Launch gates 5; #121; docs/development.md Responsiveness sampling
import type { SamplingMode } from './recorder';

export const sampling: SamplingMode | null =
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  process.env.EXPO_PUBLIC_RESPONSIVENESS_SAMPLING === '1' ? (require('./recorder') as typeof import('./recorder')).samplingMode() : null;
