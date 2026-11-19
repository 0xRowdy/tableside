// docs/decisions/text-size-type-floor.md; Spec 2 Amendment 10 §2–3; S1-12 I886X, S2-16 Np7f0
import type { AccountGate } from '@tableside/account';
import { cleanup, fireEvent, screen, within } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { SIGNED_IN } from '@/account/testing/fake-account';
import type { MemorySettingsStorage } from '@/feedback/testing/substitutes';
import { parseTextSize, TextSizeSetting } from '@/theme/text-size';
import { textScale, typeRamp } from '@/theme/tokens';

type Stored = { stored: string | null; latest: MemorySettingsStorage | null };
const textSize = jest.requireMock<Stored>('@/theme/device-storage');
const launch = jest.requireMock<{ stored: AccountGate; offlineGame: string | null }>('@/account/app-account');

const PREVIEW_BODY = 'Check holds all feedback until the end.';
const CHOSEN = '{"step":"standard"}';

beforeAll(async () => {
  await renderRouter('./src/app', { initialUrl: '/' });
  await cleanup();
}, 180_000);

afterEach(() => {
  textSize.stored = CHOSEN;
});

describe('the text size setting', () => {
  it('reads a stored step and treats anything else as unchosen Standard', () => {
    expect(parseTextSize('{"step":"larger"}')).toEqual({ step: 'larger', chosen: true });
    expect(parseTextSize(null)).toEqual({ step: 'standard', chosen: false });
    expect(parseTextSize('{"step":"huge"}')).toEqual({ step: 'standard', chosen: false });
    expect(parseTextSize('not json')).toEqual({ step: 'standard', chosen: false });
  });

  it('applies a choice at once and keeps it when the write fails', async () => {
    const storage = { text: null as string | null, read: async () => null, write: async () => Promise.reject(new Error('disk full')) };
    const setting = new TextSizeSetting(storage);
    await setting.load();
    await setting.choose('large');
    expect(setting.snapshot()).toEqual({ loaded: true, step: 'large', chosen: true });
  });

  it('never lets a late load undo a choice made while it was reading', async () => {
    let finish: (text: string | null) => void = () => {};
    const setting = new TextSizeSetting({ read: () => new Promise((resolve) => (finish = resolve)), write: async () => {} });
    const loading = setting.load();
    await setting.choose('larger');
    finish('{"step":"standard"}');
    await loading;
    expect(setting.snapshot().step).toBe('larger');
  });
});

describe('More › Settings › Text size (S1-12)', () => {
  beforeEach(() => {
    launch.stored = SIGNED_IN;
    launch.offlineGame = 'blackjack';
  });

  it('is a radio group whose choice is applied live, saved on this device and shown on the Settings row', async () => {
    await renderRouter('./src/app', { initialUrl: '/more/settings' });
    expect(screen.getByRole('button', { name: /^Text size\b.*Standard/ })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: /^Text size\b/ }));
    expect(await screen.findByRole('header', { name: 'Text size' })).toBeOnTheScreen();

    const options = screen.getByTestId('text-size-options');
    expect(options).toHaveProp('accessibilityRole', 'radiogroup');
    const group = within(options);
    expect(group.getAllByRole('radio').map((radio) => radio.props.accessibilityLabel)).toEqual([
      'Standard. The default size.',
      'Large. Bigger text everywhere in Tableside.',
      'Larger. The biggest. Tables and long lists scroll more.',
    ]);
    expect(group.getByRole('radio', { name: /^Standard/, checked: true })).toBeOnTheScreen();
    expect(screen.getByText(PREVIEW_BODY)).toHaveStyle({ fontSize: typeRamp.standard.body });

    await fireEvent.press(group.getByRole('radio', { name: /^Large\./ }));

    expect(group.getByRole('radio', { name: /^Large\./, checked: true })).toBeOnTheScreen();
    expect(screen.getByText(PREVIEW_BODY)).toHaveStyle({ fontSize: typeRamp.large.body });
    expect(textSize.latest?.text).toBe('{"step":"large"}');
    expect(screen.getByText('Stored on this device only. It never affects scoring or records.')).toBeOnTheScreen();
  });

  it('multiplies with the phone text size under the Inter cap', async () => {
    textSize.stored = '{"step":"larger"}';
    await renderRouter('./src/app', { initialUrl: '/more/settings/text-size' });

    const body = await screen.findByText(PREVIEW_BODY);
    expect(body).toHaveStyle({ fontSize: typeRamp.larger.body });
    expect(body).toHaveProp('maxFontSizeMultiplier', textScale.body);
  });

  it('keeps tab labels at 12 at every step', async () => {
    textSize.stored = '{"step":"larger"}';
    await renderRouter('./src/app', { initialUrl: '/more/settings/text-size' });

    const tabs = within(await screen.findByTestId('tab-bar'));
    for (const label of ['Home', 'Play', 'Counting', 'Saved', 'More']) expect(tabs.getByText(label)).toHaveStyle({ fontSize: 12 });
  });
});

describe('first run, step 0 (S2-16)', () => {
  beforeEach(() => {
    launch.stored = { state: 'no-account' };
    launch.offlineGame = null;
  });

  it('asks for a text size before Welcome on a new installation, then keeps the choice', async () => {
    textSize.stored = null;
    await renderRouter('./src/app', { initialUrl: '/' });

    expect(await screen.findByRole('header', { name: 'Choose a text size' })).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: /^Standard/, checked: true })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('radio', { name: /^Larger\./ }));
    expect(screen.getByText(PREVIEW_BODY)).toHaveStyle({ fontSize: typeRamp.larger.body });
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByRole('header', { name: 'Tableside' })).toBeOnTheScreen();
    expect(textSize.latest?.text).toBe('{"step":"larger"}');
  });

  it('saves Standard when the player continues without changing it', async () => {
    textSize.stored = null;
    await renderRouter('./src/app', { initialUrl: '/' });

    await fireEvent.press(await screen.findByRole('button', { name: 'Continue' }));

    expect(await screen.findByRole('header', { name: 'Tableside' })).toBeOnTheScreen();
    expect(textSize.latest?.text).toBe(CHOSEN);
  });

  it('goes straight to Welcome once a size has been chosen on this device', async () => {
    await renderRouter('./src/app', { initialUrl: '/' });

    expect(await screen.findByRole('header', { name: 'Tableside' })).toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: 'Choose a text size' })).toBeNull();
  });
});
