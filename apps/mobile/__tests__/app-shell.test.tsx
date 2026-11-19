import { act, cleanup, fireEvent, screen, within } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { Platform } from 'react-native';

const TAB_LABELS = ['Home', 'Play', 'Counting', 'Saved', 'More'];

async function renderApp(initialUrl = '/') {
  await renderRouter('./src/app', { initialUrl });
}

function tabBar() {
  const bar = screen.getByTestId('tab-bar');
  expect(bar).toHaveProp('accessibilityRole', 'tablist');
  return within(bar);
}

describe('app shell', () => {
  beforeAll(async () => {
    await renderApp();
    await cleanup();
  }, 180_000);

  it('opens on Home with the five labelled tabs and Home selected', async () => {
    await renderApp();

    expect(tabBar().getAllByRole('tab').map((tab) => tab.props.accessibilityLabel)).toEqual(TAB_LABELS);
    expect(tabBar().getByRole('tab', { name: 'Home', selected: true })).toBeOnTheScreen();
    expect(tabBar().getAllByRole('tab', { selected: true })).toHaveLength(1);
  });

  it('keeps tab labels at a fixed size when system text is enlarged', async () => {
    await renderApp();

    for (const label of TAB_LABELS) {
      expect(tabBar().getByText(label)).toHaveProp('allowFontScaling', false);
    }
  });

  it('shows exactly three game cards and no wallet or balance', async () => {
    await renderApp();

    const cards = screen.getAllByRole('button', { name: /^(Blackjack|Craps|Roulette)\b/ });
    expect(cards.map((card) => card.props.accessibilityLabel.split('.')[0])).toEqual(['Blackjack', 'Craps', 'Roulette']);
    expect(screen.queryByText(/balance|wallet|chips|\$/i)).toBeNull();
  });

  it('opens Play on the setup for the chosen game', async () => {
    await renderApp();

    await fireEvent.press(screen.getByRole('button', { name: /^Craps\b/ }));

    expect(await screen.findByRole('header', { name: 'Craps' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Start free play' })).toBeOnTheScreen();
    expect(tabBar().getByRole('tab', { name: 'Play', selected: true })).toBeOnTheScreen();
  });

  it.each(['Counting', 'Saved', 'More'])('shows a placeholder for %s and keeps the tab bar', async (label) => {
    await renderApp();

    await fireEvent.press(tabBar().getByRole('tab', { name: label }));

    expect(await screen.findByRole('header', { name: label })).toBeOnTheScreen();
    expect(tabBar().getByRole('tab', { name: label, selected: true })).toBeOnTheScreen();
    expect(tabBar().getAllByRole('tab')).toHaveLength(5);
  });

  // Spec 2 Amendment 10 §1; spec 6 Amendment 5
  it('opens Community from the top of More, with More selected', async () => {
    await renderApp();

    await fireEvent.press(tabBar().getByRole('tab', { name: 'More' }));
    await fireEvent.press(await screen.findByRole('button', { name: /^Community\b/ }));

    expect(await screen.findByRole('header', { name: 'Community' })).toBeOnTheScreen();
    expect(tabBar().getByRole('tab', { name: 'More', selected: true })).toBeOnTheScreen();
  });

  it('opens Community from the Home header', async () => {
    await renderApp();

    await fireEvent.press(screen.getByRole('button', { name: 'Community' }));

    expect(await screen.findByRole('header', { name: 'Community' })).toBeOnTheScreen();
    expect(tabBar().getByRole('tab', { name: 'More', selected: true })).toBeOnTheScreen();
  });

  it('shows Play without a game as a prompt to choose one on Home', async () => {
    await renderApp();

    await fireEvent.press(tabBar().getByRole('tab', { name: 'Play' }));

    expect(await screen.findByRole('header', { name: 'Play' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Choose a game' }));
    expect(await screen.findByRole('button', { name: /^Blackjack\b/ })).toBeOnTheScreen();
  });

  it('gives every tab a touch target of at least 48 points', async () => {
    await renderApp();

    for (const tab of tabBar().getAllByRole('tab')) {
      expect(tab).toHaveStyle({ minHeight: 48, minWidth: 48 });
    }
  });

  const onIos = Platform.OS === 'ios' ? it : it.skip;
  const onAndroid = Platform.OS === 'android' ? it : it.skip;

  onIos('gives the Large Content Viewer each tab label and symbol, and selects the tab the finger lifts on', async () => {
    await renderApp();

    // docs/development.md Accessibility notes for the shell
    const items = screen.getAllByTestId('large-content-item');
    expect(items.map((item) => item.props.title)).toEqual(TAB_LABELS);
    expect(items.every((item) => typeof item.props.systemImage === 'string')).toBe(true);

    const saved = items[TAB_LABELS.indexOf('Saved')]!;
    await act(() => saved.props.onSelect());
    expect(await screen.findByRole('header', { name: 'Saved' })).toBeOnTheScreen();
    expect(tabBar().getByRole('tab', { name: 'Saved', selected: true })).toBeOnTheScreen();
  });

  onAndroid('lets a long press preview the tab label at accessibility text sizes and selects it on release', async () => {
    await renderApp();
    const { Dimensions } = require('react-native') as typeof import('react-native');
    const window = Dimensions.get('window');
    const android10LargestFontScale = Math.fround(1.3);
    await act(() => Dimensions.set({ window: { ...window, fontScale: android10LargestFontScale }, screen: { ...window, fontScale: android10LargestFontScale } }));

    const saved = tabBar().getByRole('tab', { name: 'Saved' });
    await fireEvent(saved, 'longPress');
    const preview = screen.getByTestId('large-content-preview', { includeHiddenElements: true });
    expect(preview).toHaveTextContent('Saved');
    expect(preview).not.toBeVisible();

    await fireEvent(saved, 'pressOut');
    expect(screen.queryByTestId('large-content-preview', { includeHiddenElements: true })).toBeNull();
    expect(await screen.findByRole('header', { name: 'Saved' })).toBeOnTheScreen();
  });
});
