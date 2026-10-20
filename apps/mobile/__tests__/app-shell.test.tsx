import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

const TAB_LABELS = ['Home', 'Play', 'Counting', 'Community', 'Saved', 'More'];

async function renderApp(initialUrl = '/') {
  await renderRouter('./src/app', { initialUrl });
}

// The tab bar is a tablist container, not an accessibility element itself, so
// screen readers announce each tab's position ("tab, 1 of 6").
function tabBar() {
  const bar = screen.getByTestId('tab-bar');
  expect(bar).toHaveProp('accessibilityRole', 'tablist');
  return within(bar);
}

describe('app shell', () => {
  it('opens on Home with the six labelled tabs and Home selected', async () => {
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

  it('opens Play on the setup placeholder for the chosen game', async () => {
    await renderApp();

    await fireEvent.press(screen.getByRole('button', { name: /^Craps\b/ }));

    expect(await screen.findByRole('header', { name: 'Craps setup' })).toBeOnTheScreen();
    expect(tabBar().getByRole('tab', { name: 'Play', selected: true })).toBeOnTheScreen();
  });

  it.each(['Counting', 'Community', 'Saved', 'More'])('shows a placeholder for %s and keeps the tab bar', async (label) => {
    await renderApp();

    await fireEvent.press(tabBar().getByRole('tab', { name: label }));

    expect(await screen.findByRole('header', { name: label })).toBeOnTheScreen();
    expect(tabBar().getByRole('tab', { name: label, selected: true })).toBeOnTheScreen();
    expect(tabBar().getAllByRole('tab')).toHaveLength(6);
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

  it('lets a long press preview the tab label at accessibility text sizes and selects it on release', async () => {
    const { Platform } = require('react-native') as typeof import('react-native');
    if (Platform.OS !== 'android') return; // iOS uses the native Large Content Viewer.
    await renderApp();
    const { Dimensions } = require('react-native') as typeof import('react-native');
    const window = Dimensions.get('window');
    // Android 10's largest font scale, as a device reports it: 1.3 stored as a 32-bit float.
    const fontScale = Math.fround(1.3);
    await act(() => Dimensions.set({ window: { ...window, fontScale }, screen: { ...window, fontScale } }));

    const saved = tabBar().getByRole('tab', { name: 'Saved' });
    await fireEvent(saved, 'longPress');
    // A visual aid only: screen readers already hear the full label.
    const preview = screen.getByTestId('large-content-preview', { includeHiddenElements: true });
    expect(preview).toHaveTextContent('Saved');
    expect(preview).not.toBeVisible();

    await fireEvent(saved, 'pressOut');
    expect(screen.queryByTestId('large-content-preview', { includeHiddenElements: true })).toBeNull();
    expect(await screen.findByRole('header', { name: 'Saved' })).toBeOnTheScreen();
  });
});
