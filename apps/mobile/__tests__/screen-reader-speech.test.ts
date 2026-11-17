// Spec 3 User stories 64–65; Attempt lifecycle › Automatic pacing; #136
import { AccessibilityInfo } from 'react-native';

import { screenReaderSpeech } from '@/training/screen-reader';

type Listener = (event: unknown) => void;

function fakeAccessibility(enabled: boolean) {
  const listeners = new Map<string, Listener>();
  const said: string[] = [];
  jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(enabled);
  jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation((message: string) => void said.push(message));
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((name: string, listener: Listener) => {
    listeners.set(name, listener);
    return { remove: () => listeners.delete(name) };
  }) as never);
  return { said, emit: (name: string, event: unknown) => listeners.get(name)?.(event) };
}

const flush = () => new Promise<void>((resolve) => process.nextTick(resolve));

describe('screen-reader speech', () => {
  afterEach(() => jest.restoreAllMocks());

  it('on iOS, speaks each announcement and is speaking until VoiceOver reports it finished', async () => {
    const accessibility = fakeAccessibility(true);
    let time = 0;
    const speech = screenReaderSpeech('ios', () => time);
    await flush();
    speech.announce('7 of hearts');
    expect(accessibility.said).toEqual(['7 of hearts']);
    time = 3_000;
    expect(speech.speaking()).toBe(true);
    accessibility.emit('announcementFinished', { announcement: '7 of hearts', success: true });
    expect(speech.speaking()).toBe(false);
  });

  it('on Android, is speaking for about as long as TalkBack takes to read the words', async () => {
    fakeAccessibility(true);
    let time = 0;
    const speech = screenReaderSpeech('android', () => time);
    await flush();
    speech.announce('Queen of diamonds');
    time = 500;
    expect(speech.speaking()).toBe(true);
    time = 2_500;
    expect(speech.speaking()).toBe(false);
  });

  it('is never speaking while no screen reader runs, and follows it being switched on', async () => {
    const accessibility = fakeAccessibility(false);
    const time = 0;
    const speech = screenReaderSpeech('ios', () => time);
    await flush();
    speech.announce('Ace of spades');
    expect(speech.speaking()).toBe(false);
    accessibility.emit('screenReaderChanged', true);
    speech.announce('King of clubs');
    expect(speech.speaking()).toBe(true);
  });
});
