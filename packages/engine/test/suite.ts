// The engine's cross-runtime suite. It runs on Node, iOS Hermes and Android
// Hermes, and the harness compares every case's outputs across them, so cases
// must be synchronous and deterministic. Every engine ticket adds its cases here.
import type { Suite } from '@tableside/harness';

import { engineCases } from './engine.cases';
import { runtimeCases } from './runtime.cases';

export const engineSuite: Suite = {
  name: 'engine',
  cases: [...runtimeCases, ...engineCases],
};
