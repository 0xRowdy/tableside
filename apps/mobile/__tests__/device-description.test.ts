// Spec 2 S2-19

import { describeDevice, lastActiveText } from '@/account/account-text';

describe('describeDevice', () => {
  it('names the model and the OS with its major version', () => {
    expect(describeDevice('ios', { modelName: 'iPhone 15', osName: 'iOS', osVersion: '18.1.1' })).toEqual({ platform: 'ios', label: 'iPhone 15 · iOS 18' });
    expect(describeDevice('ios', { modelName: 'iPad Air', osName: 'iPadOS', osVersion: '18.0' })).toEqual({ platform: 'ios', label: 'iPad Air · iPadOS 18' });
    expect(describeDevice('android', { modelName: 'Pixel 8', osName: 'Android', osVersion: '15' })).toEqual({ platform: 'android', label: 'Pixel 8 · Android 15' });
  });

  it('says Android whatever the build calls its OS, and falls back when the model is unknown', () => {
    expect(describeDevice('android', { modelName: null, osName: 'POCO/vayu_eea/vayu:11/RKQ1', osVersion: '11' }).label).toBe('Android device · Android 11');
    expect(describeDevice('ios', { modelName: ' ', osName: null, osVersion: null }).label).toBe('iPhone · iOS');
  });
});

describe('lastActiveText', () => {
  const now = Date.parse('2026-10-17T12:00:00Z');
  it.each([
    [now - 30_000, 'Last active now'],
    [now - 5 * 60_000, 'Last active 5 minutes ago'],
    [now - 3 * 3_600_000, 'Last active 3 hours ago'],
    [now - 2 * 86_400_000 - 3_600_000, 'Last active 2 days ago'],
    [now - 95 * 86_400_000, 'Last active 3 months ago'],
    [now - 800 * 86_400_000, 'Last active 2 years ago'],
  ])('%s', (then, text) => expect(lastActiveText(then, now)).toBe(text));
});
