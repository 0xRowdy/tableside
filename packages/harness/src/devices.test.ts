import { describe, expect, it } from 'vitest';

import { isEmulatorSerial, parseAdbDevices, parseAvdList } from './devices';

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

describe('parseAdbDevices', () => {
  it('lists ready devices, emulators and network devices alike', () => {
    const output = [
      'List of devices attached',
      '192.168.0.109:5555\tdevice',
      'emulator-5554\tdevice',
      'emulator-5556\toffline',
      'R58M123ABC\tunauthorized',
      '',
    ].join('\n');
    expect(parseAdbDevices(output)).toEqual(['192.168.0.109:5555', 'emulator-5554']);
  });

  it('tells emulators from other devices by serial', () => {
    expect(['192.168.0.109:5555', 'emulator-5554'].filter(isEmulatorSerial)).toEqual(['emulator-5554']);
  });
});
