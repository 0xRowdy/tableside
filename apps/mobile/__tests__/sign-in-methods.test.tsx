// Seam 3: Sign-in methods (#100, S2-18) through the real routes and the
// accessibility tree, over Account-service fakes: the methods and what to
// add, Confirm it's you before every change, a method another account uses,
// the last method, and Change email with both addresses' codes.

import type { AccountGate } from '@tableside/account';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { Dimensions } from 'react-native';

import { SIGNED_IN, type fakeAppAccount } from '@/account/testing/fake-account';
import type { GameId } from '@/games';

jest.mock('@/practice/app-adapters', () => {
  const { FakeClock, substituteAdapters } = jest.requireActual('@/practice/testing/substitutes');
  return { createAppAdapters: () => substituteAdapters({ clock: new FakeClock(undefined, true) }) };
});

type Launch = { stored: AccountGate; offlineGame: GameId | null; latest: ReturnType<typeof fakeAppAccount> | null };
const launch = jest.requireMock<Launch>('@/account/app-account');
const service = () => launch.latest!.service;

let logged: unknown[][] = [];

beforeAll(async () => {
  for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    jest.spyOn(console, method).mockImplementation((...args: unknown[]) => void logged.push(args));
  }
  await renderRouter('./src/app', { initialUrl: '/' });
  await cleanup();
}, 180_000);

beforeEach(() => {
  launch.stored = SIGNED_IN;
  launch.offlineGame = 'blackjack';
  logged = [];
});

afterEach(() => setWindow(390, 844));

async function setWindow(width: number, height: number, fontScale = 1) {
  const window = Dimensions.get('window');
  await act(() => Dimensions.set({ window: { ...window, width, height, fontScale }, screen: { ...window, width, height, fontScale } }));
}

const header = (name: string | RegExp) => screen.findByRole('header', { name });
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const sheet = () => within(screen.getByTestId('confirm-its-you'));

/** Opens Sign-in methods from Account, after `prepare` scripts the fake. */
async function openMethods(prepare?: () => void) {
  await renderRouter('./src/app', { initialUrl: '/more/settings/account' });
  prepare?.();
  await fireEvent.press(await screen.findByRole('button', { name: /^Sign-in methods\./ }));
  await header('Sign-in methods');
  await screen.findByLabelText(/^Apple\./);
}

/** Confirms it's you in the open sheet with the email code. */
async function confirmWithCode(code = '123456') {
  await fireEvent.press(sheet().getByRole('button', { name: 'Send a code to player@example.com' }));
  await fireEvent.changeText(await sheet().findByLabelText('Code'), code);
  await fireEvent.press(sheet().getByRole('button', { name: 'Confirm' }));
}

describe('Sign-in methods', () => {
  it('lists each method with its address, and explains the benefit of a second one without requiring it', async () => {
    await openMethods(() => {
      service().methods = [{ id: 'method-apple', method: 'apple', email: 'x7k2@privaterelay.appleid.com' }];
    });

    expect(screen.getByText('You need at least one way to sign in. A second one helps if you lose access to the first.')).toBeOnTheScreen();
    expect(screen.getByLabelText('Apple. Hide My Email · x7k2@privaterelay.appleid.com')).toBeOnTheScreen();
    expect(button('Remove Apple')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'ADD A METHOD' })).toBeOnTheScreen();
    expect(button('Add Google. A backup way in if you lose access to Apple')).toBeOnTheScreen();
    expect(button('Add Email code. A backup way in if you lose access to Apple')).toBeOnTheScreen();
    expect(screen.getByText("Changes ask you to confirm it's you. We email you when a method is added or a device is signed out.")).toBeOnTheScreen();
    // Nothing asks for a second method before going back.
    await fireEvent.press(button('Back to Account'));
    expect(await header('Account')).toBeOnTheScreen();
  });

  it('shows the email code as verified, with Change email', async () => {
    await openMethods();
    expect(screen.getByLabelText('Email code. player@example.com · verified')).toBeOnTheScreen();
    expect(button('Change email')).toBeOnTheScreen();
    expect(button('Remove Email code')).toBeOnTheScreen();
  });
});

describe('adding a method', () => {
  it('asks to confirm it’s you first, then adds it and says the account was emailed', async () => {
    await openMethods();
    await fireEvent.press(button(/^Add Google\./));

    expect(await header("Confirm it's you")).toBeOnTheScreen();
    expect(sheet().getByText("Adding Google changes how you sign in, so sign in again first. Being signed in already isn't enough for this.")).toBeOnTheScreen();
    expect(sheet().getByRole('button', { name: 'Send a code to player@example.com' })).toBeOnTheScreen();
    await fireEvent.press(sheet().getByRole('button', { name: 'Continue with Apple' }));

    expect(await screen.findByText("Google added. We've emailed you about it.")).toBeOnTheScreen();
    expect(service().methodCalls).toEqual(['fresh apple', 'link google']);
    expect(await screen.findByLabelText('Google. google@example.com')).toBeOnTheScreen();
    expect(screen.queryByTestId('confirm-its-you')).toBeNull();
  });

  it('confirms with an emailed code, and a wrong code says so', async () => {
    await openMethods();
    await fireEvent.press(button(/^Add Google\./));
    service().methodsNext.fresh.push({ status: 'invalid-code' });
    await confirmWithCode('000000');
    expect(await sheet().findByText("That code didn't work. Check it, or send a new code.")).toBeOnTheScreen();

    await fireEvent.changeText(sheet().getByLabelText('Code'), '123456');
    await fireEvent.press(sheet().getByRole('button', { name: 'Confirm' }));
    expect(await screen.findByText("Google added. We've emailed you about it.")).toBeOnTheScreen();
    expect(service().methodCalls).toEqual(['fresh code-request', 'fresh code 000000', 'fresh code 123456', 'link google']);
    // No code reaches a label or a log.
    expect(JSON.stringify(logged)).not.toContain('123456');
  });

  it('says when the Apple ID used to confirm isn’t one of this account’s', async () => {
    await openMethods();
    await fireEvent.press(button(/^Add Google\./));
    service().methodsNext.fresh.push({ status: 'not-a-method' });
    await fireEvent.press(sheet().getByRole('button', { name: 'Continue with Apple' }));
    expect(await sheet().findByText("That Apple ID isn't one of this account's sign-in methods. Use the one you sign in with.")).toBeOnTheScreen();
    expect(service().methodCalls).toEqual(['fresh apple']);
  });

  it('owned by another account explains there is no merge, and offers another identity or the way back', async () => {
    await openMethods(() => {
      service().methodsNext.link.push({ status: 'conflict' });
    });
    await fireEvent.press(button(/^Add Google\./));
    await fireEvent.press(sheet().getByRole('button', { name: 'Continue with Apple' }));

    expect(await screen.findByRole('alert', { name: 'This Google account is already in use' })).toBeOnTheScreen();
    expect(screen.getByText("It's linked to a different Tableside account. We never merge accounts, so histories and purchases stay separate.")).toBeOnTheScreen();
    expect(screen.getByText('To use this Google account here, sign in to the other account, remove Google there, then try again.')).toBeOnTheScreen();

    await fireEvent.press(button('Choose a different Google account'));
    expect(await screen.findByText("Google added. We've emailed you about it.")).toBeOnTheScreen();
    expect(service().methodCalls).toEqual(['fresh apple', 'link google', 'link google']);
  });

  it('back from a conflict returns to the list unchanged', async () => {
    await openMethods(() => {
      service().methodsNext.link.push({ status: 'conflict' });
    });
    await fireEvent.press(button(/^Add Google\./));
    await fireEvent.press(sheet().getByRole('button', { name: 'Continue with Apple' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Back to sign-in methods' }));
    expect(await screen.findByRole('button', { name: /^Add Google\./ })).toBeOnTheScreen();
  });

  it('adds the email code with the code sent to the sign-in email', async () => {
    await openMethods(() => {
      service().methods = [{ id: 'method-apple', method: 'apple', email: 'x7k2@privaterelay.appleid.com' }];
    });
    await fireEvent.press(button(/^Add Email code\./));
    await fireEvent.press(sheet().getByRole('button', { name: 'Continue with Apple' }));

    const code = within(await screen.findByTestId('add-email-code'));
    expect(code.getByText('Enter the code we sent to player@example.com. Then you can sign in with a code sent there.')).toBeOnTheScreen();
    await fireEvent.changeText(code.getByLabelText('Code'), '654321');
    await fireEvent.press(code.getByRole('button', { name: 'Add email code' }));
    expect(await screen.findByText("Email code added. We've emailed you about it.")).toBeOnTheScreen();
    expect(service().methodCalls).toEqual(['fresh apple', 'email-method code-request', 'email-method code 654321']);
  });
});

describe('removing a method', () => {
  it('never removes the only one, and says to add another first', async () => {
    await openMethods(() => {
      service().methods = [{ id: 'method-apple', method: 'apple', email: 'x7k2@privaterelay.appleid.com' }];
    });
    await fireEvent.press(button('Remove Apple'));
    expect(await screen.findByRole('alert', { name: 'This is your only way to sign in' })).toBeOnTheScreen();
    expect(screen.getByText('Removing it would lock you out. Add another method first, then you can remove this one.')).toBeOnTheScreen();
    expect(screen.queryByTestId('confirm-its-you')).toBeNull();

    await fireEvent.press(button('Add a method'));
    expect(await header("Confirm it's you")).toBeOnTheScreen();
    expect(service().methodCalls).toEqual([]);
  });

  it('confirms through a method that stays, then removes it', async () => {
    await openMethods();
    await fireEvent.press(button('Remove Apple'));
    expect(
      await sheet().findByText("Removing Apple changes how you sign in, so sign in again first with a method you're keeping. Being signed in already isn't enough for this."),
    ).toBeOnTheScreen();
    // Apple is the one going, so only the email code can confirm.
    expect(sheet().queryByRole('button', { name: 'Continue with Apple' })).toBeNull();
    await confirmWithCode();

    expect(await screen.findByText('Apple removed.')).toBeOnTheScreen();
    expect(screen.queryByLabelText(/^Apple\./)).toBeNull();
    expect(service().methodCalls).toEqual(['fresh code-request', 'fresh code 123456', 'remove method-apple']);
  });

  it('asks again when the confirmation has run out', async () => {
    await openMethods(() => {
      service().methodsNext.remove.push({ status: 'fresh-authentication-required' });
    });
    await fireEvent.press(button('Remove Apple'));
    await confirmWithCode();
    // The removal answered that the confirmation ran out: the sheet opens again, from the start.
    await waitFor(() => expect(service().methodCalls).toContain('remove method-apple'));
    expect(await sheet().findByRole('button', { name: 'Send a code to player@example.com' })).toBeOnTheScreen();
    await confirmWithCode();
    expect(await screen.findByText('Apple removed.')).toBeOnTheScreen();
  });
});

describe('Change email', () => {
  it('confirms it’s you first, then sends a code to both addresses and needs both', async () => {
    await openMethods();
    await fireEvent.press(button('Change email'));
    expect(await header('Change email')).toBeOnTheScreen();
    expect(
      await sheet().findByText("Changing your sign-in email affects how you get back in, so sign in again first. We'll then confirm both the old and new address."),
    ).toBeOnTheScreen();
    await fireEvent.press(sheet().getByRole('button', { name: 'Continue with Apple' }));

    expect(screen.getByLabelText('Current email').props.value).toBe('player@example.com');
    expect(
      screen.getByText("We'll send a code to both addresses. Your current address keeps working until both are confirmed. If you can't reach your current address, contact support."),
    ).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('New email'), 'player.new@example.com');
    await fireEvent.press(button('Send codes'));

    await fireEvent.changeText(await screen.findByLabelText('Code sent to player@example.com'), '111111');
    await fireEvent.changeText(screen.getByLabelText('Code sent to player.new@example.com'), '222222');
    service().methodsNext.confirmEmailChange.push({ status: 'invalid-code', address: 'new' });
    await fireEvent.press(button('Confirm email change'));
    expect(await screen.findByText("The code sent to player.new@example.com didn't work. Check it and try again.")).toBeOnTheScreen();

    await fireEvent.press(button('Confirm email change'));
    expect(await screen.findByText('Your sign-in email is now player.new@example.com.')).toBeOnTheScreen();
    expect(service().methodCalls).toEqual([
      'fresh apple',
      'change-email player.new@example.com',
      'confirm-email-change 111111 222222',
      'confirm-email-change 111111 222222',
    ]);
  });

  it('says when another account uses the new address', async () => {
    await openMethods(() => {
      service().methodsNext.changeEmail.push({ status: 'in-use' });
    });
    await fireEvent.press(button('Change email'));
    await fireEvent.press(await sheet().findByRole('button', { name: 'Continue with Apple' }));
    await fireEvent.changeText(screen.getByLabelText('New email'), 'taken@example.com');
    await fireEvent.press(button('Send codes'));
    expect(await screen.findByText('Another Tableside account uses that address. Choose a different one.')).toBeOnTheScreen();
  });

  it('closing Confirm it’s you goes back to the methods', async () => {
    await openMethods();
    await fireEvent.press(button('Change email'));
    await fireEvent.press(await sheet().findByRole('button', { name: 'Cancel' }));
    expect(await header('Sign-in methods')).toBeOnTheScreen();
  });
});

describe('at the largest text size', () => {
  it('keeps every method and action, and Confirm it’s you takes the whole screen', async () => {
    await setWindow(390, 844, 3.1);
    await openMethods();
    expect(button('Remove Apple')).toBeOnTheScreen();
    expect(button('Change email')).toBeOnTheScreen();
    expect(button(/^Add Google\./)).toBeOnTheScreen();
    await fireEvent.press(button(/^Add Google\./));
    expect(await sheet().findByRole('button', { name: 'Cancel' })).toBeOnTheScreen();
  });
});
