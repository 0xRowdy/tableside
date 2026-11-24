// docs/decisions/text-size-type-floor.md rule 10; docs/decisions/lessons-entry-points.md
import { act, render, screen } from '@testing-library/react-native';
import { Dimensions, StyleSheet, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Sheet } from '@/components/Sheet';

async function setFontScale(fontScale: number) {
  const window = Dimensions.get('window');
  await act(() => Dimensions.set({ window: { ...window, fontScale }, screen: { ...window, fontScale } }));
}

const mount = () =>
  render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } }}>
      <Sheet title="Help" onClose={() => undefined}>
        <Text>Body</Text>
      </Sheet>
    </SafeAreaProvider>,
  );

const sheetStyle = () => StyleSheet.flatten(screen.getByRole('header', { name: 'Help' }).parent!.parent!.parent!.parent!.props.style);

afterEach(() => setFontScale(1));

describe('a sheet', () => {
  it('keeps clear of the status bar and home indicator once it turns full screen at large text', async () => {
    await setFontScale(2);
    await mount();
    expect(sheetStyle()).toMatchObject({ paddingTop: 47, paddingBottom: 34 });
  });

  it('sits at the bottom with no inset padding at default text', async () => {
    await mount();
    expect(sheetStyle().paddingTop).toBeUndefined();
  });
});
