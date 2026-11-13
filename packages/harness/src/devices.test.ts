import { describe, expect, it } from 'vitest';

import { parseAvdList } from './devices';

describe('parseAvdList', () => {
  it('skips the log lines emulator 34.1 prints before the AVD names', () => {
    const output = [
      'INFO    | Storing crashdata in: /tmp/android-rowdy/emu-crash-34.1.19.db, detection is enabled for process: 12558',
      'Pixel_3a_API_34_extension_level_7_arm64-v8a',
      'Pixel_8_API_35',
      '',
    ].join('\n');
    expect(parseAvdList(output)).toEqual(['Pixel_3a_API_34_extension_level_7_arm64-v8a', 'Pixel_8_API_35']);
  });

  it('returns nothing when no AVD exists', () => {
    expect(parseAvdList('INFO    | Storing crashdata in: /tmp/x.db\n')).toEqual([]);
  });
});
