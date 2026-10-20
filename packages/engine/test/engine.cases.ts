import type { TestCase } from '@tableside/harness';

import { ENGINE_VERSION } from '../src';

export const engineCases: TestCase[] = [
  {
    name: 'engine: reports its version',
    run: (t) => t.record('version', ENGINE_VERSION),
  },
];
