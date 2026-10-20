// Seam 3: More → Settings → Sound & haptics, and cues during roulette play,
// rendered through the real routes on the in-memory adapters and recording
// feedback ports, driven only through the accessibility tree.

import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { AccessibilityInfo, Dimensions, StyleSheet } from 'react-native';

import type { substituteFeedbackPorts } from '@/feedback/testing/substitutes';

jest.mock('@/practice/app-adapters', () => {
  const { FakeClock, substituteAdapters } = jest.requireActual('@/practice/testing/substitutes');
  return { createAppAdapters: () => substituteAdapters({ clock: new FakeClock(undefined, true) }) };
});

const device = jest.requireMock('@/feedback/device-ports') as {
  latest: ReturnType<typeof substituteFeedbackPorts> | null;
  stored: string | null;
};
const ports = () => device.latest!;

let announcements: string[] = [];

beforeAll(() => {
  jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation((message: string) => {
    announcements.push(message);
  });
});

beforeEach(() => {
  announcements = [];
  device.stored = null;
});

async function openSoundAndHaptics() {
  await renderRouter('./src/app', { initialUrl: '/more' });
  await fireEvent.press(await screen.findByRole('button', { name: /^Settings\b/ }));
  await fireEvent.press(await screen.findByRole('button', { name: /^Sound & haptics\b/ }));
  await screen.findByRole('header', { name: 'Sound & haptics' });
}

const slider = () => screen.getByRole('adjustable', { name: 'Sound effects' });
const hapticsSwitch = () => screen.getByRole('switch', { name: 'Haptics' });
const tabBar = () => within(screen.getByTestId('tab-bar'));

async function setWindow(width: number, height: number, fontScale = 1) {
  const window = Dimensions.get('window');
  await act(() => Dimensions.set({ window: { ...window, width, height, fontScale }, screen: { ...window, width, height, fontScale } }));
}

describe('Sound & haptics settings', () => {
  beforeAll(async () => {
    await renderRouter('./src/app', { initialUrl: '/' });
    await cleanup();
  }, 180_000);

  afterEach(() => setWindow(390, 844));

  it('is reached from More → Settings, keeping the tab bar on More', async () => {
    await renderRouter('./src/app', { initialUrl: '/more' });
    expect(await screen.findByRole('header', { name: 'More' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: /^Settings\b/ }));
    expect(await screen.findByRole('header', { name: 'Settings' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Sound & haptics. Sound effects 100% · Haptics on' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: /^Sound & haptics\b/ }));
    expect(await screen.findByRole('header', { name: 'Sound & haptics' })).toBeOnTheScreen();
    expect(tabBar().getByRole('tab', { name: 'More', selected: true })).toBeOnTheScreen();
  });

  it('has one Sound effects slider and one Haptics switch, both on by default', async () => {
    await openSoundAndHaptics();

    expect(screen.getAllByRole('adjustable')).toHaveLength(1);
    expect(screen.getAllByRole('switch')).toHaveLength(1);
    expect(slider()).toHaveAccessibilityValue({ min: 0, max: 100, now: 100, text: '100%' });
    expect(hapticsSwitch()).toBeChecked();
    expect(screen.getByText('100%')).toBeOnTheScreen();
  });

  it('turns sound effects down to off and back up, with buttons and with the adjustable actions', async () => {
    await openSoundAndHaptics();

    await fireEvent.press(screen.getByRole('button', { name: 'Lower sound effects' }));
    expect(slider()).toHaveAccessibilityValue({ now: 90, text: '90%' });

    for (let i = 0; i < 9; i++) await fireEvent(slider(), 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    expect(slider()).toHaveAccessibilityValue({ now: 0, text: 'Off' });
    // Off is said in words, not shown only by an empty track.
    expect(screen.getByText('Off')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Lower sound effects' })).toBeDisabled();

    await fireEvent(slider(), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    await fireEvent.press(screen.getByRole('button', { name: 'Raise sound effects' }));
    expect(slider()).toHaveAccessibilityValue({ now: 20, text: '20%' });
    expect(JSON.parse(ports().storage.text!)).toEqual({ soundVolume: 20, haptics: true });
  });

  it('sets the volume where the track is tapped', async () => {
    await openSoundAndHaptics();
    const track = screen.getByTestId('sound-track');
    await fireEvent(track, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 200, height: 48 } } });

    await fireEvent(track, 'responderGrant', { nativeEvent: { locationX: 140 } });

    expect(slider()).toHaveAccessibilityValue({ now: 70, text: '70%' });
  });

  it('switches haptics off and stores it on this device', async () => {
    await openSoundAndHaptics();

    await fireEvent.press(hapticsSwitch());

    expect(hapticsSwitch()).not.toBeChecked();
    expect(JSON.parse(ports().storage.text!)).toEqual({ soundVolume: 100, haptics: false });
  });

  it('shows the preferences this device already has at launch', async () => {
    device.stored = '{"soundVolume":70,"haptics":false}';
    await renderRouter('./src/app', { initialUrl: '/more/settings' });

    expect(await screen.findByRole('button', { name: 'Sound & haptics. Sound effects 70% · Haptics off' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: /^Sound & haptics\b/ }));
    expect(await screen.findByText('70%')).toBeOnTheScreen();
    expect(hapticsSwitch()).not.toBeChecked();
  });

  it('says the preferences stay on this device and that every sound has something to see', async () => {
    await openSoundAndHaptics();

    expect(screen.getByText(/Stored on this device only\. Not synced, not exported\./)).toBeOnTheScreen();
    expect(screen.getByText(/silent switch also mutes Tableside/)).toBeOnTheScreen();
    expect(screen.getByText("Follows your phone's system haptics setting.")).toBeOnTheScreen();
  });

  it('goes back to Settings and then More', async () => {
    await openSoundAndHaptics();

    await fireEvent.press(screen.getByRole('button', { name: 'Back to Settings' }));
    expect(await screen.findByRole('header', { name: 'Settings' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Back to More' }));
    expect(await screen.findByRole('header', { name: 'More' })).toBeOnTheScreen();
  });

  it('keeps every control at least 48 points', async () => {
    await openSoundAndHaptics();

    for (const control of [
      screen.getByRole('button', { name: 'Back to Settings' }),
      screen.getByRole('button', { name: 'Lower sound effects' }),
      screen.getByRole('button', { name: 'Raise sound effects' }),
      slider(),
      hapticsSwitch(),
    ]) {
      const style = StyleSheet.flatten(control.props.style);
      expect(style.minHeight ?? style.height).toBeGreaterThanOrEqual(48);
      expect(style.minWidth ?? style.width ?? 48).toBeGreaterThanOrEqual(48);
    }
  });

  it('reflows inside a scroll view at the largest text size and in landscape', async () => {
    await setWindow(844, 390, 3);
    await openSoundAndHaptics();

    expect(screen.getByTestId('settings-scroll')).toBeOnTheScreen();
    expect(slider()).toHaveAccessibilityValue({ now: 100 });
    await fireEvent.press(screen.getByRole('button', { name: 'Lower sound effects' }));
    expect(slider()).toHaveAccessibilityValue({ now: 90 });
  });

  it('plays nothing on the settings screens themselves', async () => {
    await openSoundAndHaptics();

    await fireEvent.press(screen.getByRole('button', { name: 'Lower sound effects' }));
    await fireEvent.press(hapticsSwitch());

    expect(ports().sound.played).toEqual([]);
    expect(ports().haptics.fired).toEqual([]);
  });
});

describe('cues during roulette play', () => {
  async function playRoulette() {
    await renderRouter('./src/app', { initialUrl: '/play?game=roulette' });
    await screen.findByRole('header', { name: 'Roulette' });
    await fireEvent.press(screen.getByRole('button', { name: 'Start free play' }));
    await screen.findByLabelText('Session balance 1,000');
    await fireEvent.press(screen.getByRole('button', { name: 'Spin' })); // nothing on the table
    await fireEvent.press(screen.getByRole('radio', { name: '25 chip' }));
    await fireEvent.press(screen.getByRole('button', { name: /^Red,/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Spin' }));
    await screen.findByLabelText('Session balance 1,025');
    await fireEvent.press(screen.getByRole('button', { name: 'End session' }));
    await fireEvent.press((await screen.findAllByRole('button', { name: 'End session' })).at(-1)!);
    await screen.findByRole('header', { name: 'Session result' });
    const result = { announcements, played: ports().sound.played.map((play) => play.cue), fired: ports().haptics.fired };
    await cleanup();
    announcements = [];
    return result;
  }

  it('fires the catalog cue for each visible change, and nothing else', async () => {
    const { played, fired } = await playRoulette();

    expect(played).toEqual(['input-rejected', 'stake-set', 'ball-landed', 'net-win', 'attempt-ended']);
    expect(fired).toEqual(['error', 'selection', 'impact-light', 'success', 'impact-light']);
  });

  it('plays the same session, announced the same way, with sound and haptics off', async () => {
    const on = await playRoulette();
    device.stored = '{"soundVolume":0,"haptics":false}';
    const off = await playRoulette();

    expect(off.played).toEqual([]);
    expect(off.fired).toEqual([]);
    expect(off.announcements).toEqual(on.announcements);
  });

  it('cues a buy-in the setup screen rejects', async () => {
    await renderRouter('./src/app', { initialUrl: '/play?game=roulette' });
    await fireEvent.changeText(await screen.findByLabelText('Starting chips for this session, in units'), '12.5');

    await fireEvent.press(screen.getByRole('button', { name: 'Start free play' }));

    await waitFor(() => expect(ports().sound.played.map((play) => play.cue)).toEqual(['input-rejected']));
    expect(screen.getByRole('alert')).toBeOnTheScreen();
  });
});
