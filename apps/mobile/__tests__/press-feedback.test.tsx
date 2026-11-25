// docs/decisions/press-feedback.md; design/Tableside.pen TlHUq, y0vT7, RsrEO, u6KqZy

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { Button } from '@/components/Button';
import { CoachButton } from '@/counting/CoachButton';
import { ChipRack } from '@/play/TableChrome';
import { palette } from '@/theme/tokens';

type Element = ReturnType<typeof screen.getByRole>;

const touch = {
  nativeEvent: { touches: [], changedTouches: [], identifier: 1, locationX: 0, locationY: 0, pageX: 0, pageY: 0, timestamp: 0 },
  persist: () => undefined,
  currentTarget: { measure: () => undefined },
};

const hold = (element: Element) => act(async () => void fireEvent(element, 'responderGrant', touch));
const release = (element: Element) => act(async () => void fireEvent(element, 'responderRelease', touch));
const look = (element: Element) => StyleSheet.flatten(element.props.style);

describe('press feedback on chrome controls (TlHUq)', () => {
  it('seats a primary button into Seated Brass while held, without fading it', async () => {
    await render(<Button label="Submit" onPress={() => undefined} />);
    await hold(screen.getByRole('button', { name: 'Submit' }));
    expect(look(screen.getByRole('button', { name: 'Submit' }))).toMatchObject({ backgroundColor: palette.primaryPressed, borderColor: palette.primaryPressed });
    expect(look(screen.getByRole('button', { name: 'Submit' })).opacity).toBeUndefined();
    await release(screen.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(look(screen.getByRole('button', { name: 'Submit' }))).toMatchObject({ backgroundColor: palette.primary, borderColor: palette.primary }));
  });

  it.each(['secondary', 'ghost', 'outline'] as const)('sinks a %s button to Deep Baize with its Control Edge showing', async (variant) => {
    await render(<Button label="Keep counting" variant={variant} onPress={() => undefined} />);
    await hold(screen.getByRole('button', { name: 'Keep counting' }));
    expect(look(screen.getByRole('button', { name: 'Keep counting' }))).toMatchObject({ backgroundColor: palette.muted, borderColor: palette.controlBorder });
    expect(look(screen.getByRole('button', { name: 'Keep counting' })).opacity).toBeUndefined();
  });

  it('keeps the Linen focus border while a focused button is held, so focus never reads as a press', async () => {
    await render(<Button label="Submit" onPress={() => undefined} />);
    await act(async () => void fireEvent(screen.getByRole('button', { name: 'Submit' }), 'focus'));
    expect(look(screen.getByRole('button', { name: 'Submit' }))).toMatchObject({ backgroundColor: palette.primary, borderColor: palette.foreground });
    await hold(screen.getByRole('button', { name: 'Submit' }));
    expect(look(screen.getByRole('button', { name: 'Submit' }))).toMatchObject({ backgroundColor: palette.primaryPressed, borderColor: palette.foreground });
  });

  it('leaves an unavailable button at 40% with no press response', async () => {
    await render(<Button label="Submit" disabled onPress={() => undefined} />);
    await hold(screen.getByRole('button', { name: 'Submit' }));
    expect(look(screen.getByRole('button', { name: 'Submit' }))).toMatchObject({ backgroundColor: palette.primary, opacity: 0.4 });
  });

  it('presses Marcus’s actions into the paper: ink softens, the outline action takes pressed paper', async () => {
    await render(
      <>
        <CoachButton label="Try again" primary enabled onPress={() => undefined} />
        <CoachButton label="Play anyway" enabled onPress={() => undefined} />
      </>,
    );
    await hold(screen.getByRole('button', { name: 'Try again' }));
    await hold(screen.getByRole('button', { name: 'Play anyway' }));
    expect(look(screen.getByRole('button', { name: 'Try again' }))).toMatchObject({ backgroundColor: palette.inkPressed, borderColor: palette.inkPressed });
    expect(look(screen.getByRole('button', { name: 'Play anyway' }))).toMatchObject({ backgroundColor: palette.coachPressed, borderColor: palette.inkMuted });
  });
});

describe('press feedback on table pieces (RsrEO)', () => {
  it('shades a chip’s slot on the rail while held', async () => {
    await render(<ChipRack chip="5" onChoose={() => undefined} />);
    const chip = () => screen.getByRole('radio', { name: '25 chip' });
    expect(within(chip()).queryByTestId('press-shade')).toBeNull();
    await hold(chip());
    expect(within(chip()).getByTestId('press-shade')).toHaveStyle({ backgroundColor: palette.pressShade });
    await release(chip());
    await waitFor(() => expect(within(chip()).queryByTestId('press-shade')).toBeNull());
  });
});
