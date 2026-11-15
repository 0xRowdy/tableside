// @vitest-environment jsdom
// The web account page (S2-24) through its document, as a keyboard or
// screen-reader user meets it: headings, labelled fields, native controls,
// focus that moves to each new step and is never lost, and messages in live
// regions. The account is a fake that answers as the server would (seam 2's
// web-account-page.test.ts drives the real one against the stack).

import type { CancelDeletionResult, DeletePermanentlyResult, DeletionProgress, ScheduleDeletionResult, WebAccount, WebAccountView } from '@tableside/account/web';
import { beforeEach, describe, expect, it } from 'vitest';

import { mountAccountPage } from './page';

const DAY_MS = 24 * 60 * 60_000;
const DEADLINE = Date.UTC(2026, 11, 15, 12);

class FakeAccount implements WebAccount {
  view: WebAccountView = { state: 'signed-out' };
  fresh = false;
  signInAnswer: 'signed-in' | 'invalid-code' | 'failed' = 'signed-in';
  calls: string[] = [];
  async start() {
    return this.view;
  }
  async refresh() {
    this.calls.push('refresh');
    return this.view;
  }
  async requestCode(email: string) {
    this.calls.push(`code:${email}`);
    return { status: 'sent' } as const;
  }
  async signIn(email: string) {
    if (this.signInAnswer === 'signed-in') this.view = { state: 'signed-in', email, deletion: { status: 'none' } };
    return { status: this.signInAnswer };
  }
  confirm = {
    requestCode: async () => ({ status: 'sent' }) as const,
    withCode: async (code: string) => {
      if (code !== '123456') return { status: 'invalid-code' } as const;
      this.fresh = true;
      return { status: 'confirmed' } as const;
    },
  };
  async schedule(): Promise<ScheduleDeletionResult> {
    if (!this.fresh) return { status: 'fresh-authentication-required' };
    if (this.view.state === 'signed-in') this.view = { ...this.view, deletion: { status: 'scheduled', deadline: DEADLINE, scheduledAt: DEADLINE - 30 * DAY_MS } };
    return { status: 'scheduled', deadline: DEADLINE };
  }
  async cancel(): Promise<CancelDeletionResult> {
    if (!this.fresh) return { status: 'fresh-authentication-required' };
    if (this.view.state === 'signed-in') this.view = { ...this.view, deletion: { status: 'none' } };
    return { status: 'canceled' };
  }
  async deletePermanently(): Promise<DeletePermanentlyResult> {
    if (!this.fresh) return { status: 'fresh-authentication-required' };
    this.view = { state: 'deleted', progress: progress('processing') };
    return { status: 'deleted' };
  }
  async signOut() {
    this.view = { state: 'signed-out' };
  }
  async dismiss() {
    this.view = { state: 'signed-out' };
  }
}

function progress(status: 'processing' | 'completed'): DeletionProgress {
  return {
    status,
    deletedAt: DEADLINE,
    cleanupBy: DEADLINE + 7 * DAY_MS,
    completedAt: status === 'completed' ? DEADLINE + DAY_MS : null,
    delayed: false,
    analytics: { requestedAt: DEADLINE, completedAt: null },
    providers: 'not-held',
  };
}

let main: HTMLElement;
let account: FakeAccount;

beforeEach(() => {
  document.body.innerHTML = '<main id="page"></main>';
  main = document.getElementById('page')!;
  account = new FakeAccount();
});

/** Waits for the page to finish its step (it is busy while one runs). */
async function settled() {
  for (let i = 0; i < 20; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (main.getAttribute('aria-busy') !== 'true') return;
  }
  throw new Error('the page stayed busy');
}

const heading = () => main.querySelector('h1')?.textContent;
const buttonNamed = (name: string) => {
  const found = [...main.querySelectorAll('button')].find((node) => node.textContent === name);
  if (!found) throw new Error(`no button "${name}"`);
  return found;
};
const fieldLabelled = (label: string) => {
  const forId = [...main.querySelectorAll('label')].find((node) => node.textContent === label)?.getAttribute('for');
  const input = forId ? main.ownerDocument.getElementById(forId) : null;
  if (!(input instanceof HTMLInputElement)) throw new Error(`no field labelled "${label}"`);
  return input;
};
async function submit(label: string, value: string) {
  const input = fieldLabelled(label);
  input.value = value;
  input.form!.requestSubmit();
  await settled();
}
async function press(name: string) {
  buttonNamed(name).click();
  await settled();
}
const announced = () => main.querySelector('[role="status"]')?.textContent;
const problem = () => main.querySelector('[role="alert"]')?.textContent;

async function signedIn() {
  await mountAccountPage(main, account);
  await submit('Email', 'player@example.com');
  await submit('Code', '654321');
}

describe('signing in', () => {
  it('asks for an email, then the code, moving focus to each step and announcing the neutral answer', async () => {
    await mountAccountPage(main, account);
    expect(heading()).toBe('Your Tableside account');
    expect(document.activeElement).toBe(main.querySelector('h1'));
    expect(fieldLabelled('Email').getAttribute('autocomplete')).toBe('email');

    await submit('Email', ' player@example.com ');
    expect(account.calls).toContain('code:player@example.com');
    expect(heading()).toBe('Enter your code');
    expect(document.activeElement).toBe(fieldLabelled('Code'));
    expect(fieldLabelled('Code').getAttribute('autocomplete')).toBe('one-time-code');
    // The same words whether or not the address has an account (Amendment 1 B1).
    expect(announced()).toBe("If an account exists for this address, we've sent a code.");
  });

  it('says why a code was refused, on the field, and keeps focus there', async () => {
    account.signInAnswer = 'invalid-code';
    await mountAccountPage(main, account);
    await submit('Email', 'player@example.com');
    await submit('Code', '000000');
    expect(problem()).toMatch(/That code didn't work/);
    expect(fieldLabelled('Code').getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(fieldLabelled('Code'));
  });

  it('refuses an address that isn’t one without asking the server', async () => {
    await mountAccountPage(main, account);
    await submit('Email', 'not an address');
    expect(account.calls).toEqual([]);
    expect(problem()).toMatch(/Enter your email address/);
    expect(document.activeElement).toBe(fieldLabelled('Email'));
  });
});

describe('the deletion choice', () => {
  it('asks to confirm it’s you first, then offers schedule or Delete permanently now with their warnings and both stores’ billing help', async () => {
    await signedIn();
    expect(heading()).toBe('Delete your account');
    expect(main.textContent).toContain('Signed in as player@example.com.');
    expect(() => buttonNamed('Schedule deletion')).toThrow();

    await press("Confirm it's you");
    expect(document.activeElement).toBe(fieldLabelled('Code'));
    await submit('Code', '123456');
    expect(announced()).toBe('Confirmed.');
    for (const store of ['App Store', 'Google Play']) {
      expect(main.textContent).toContain(`Manage subscription · ${store}`);
      expect(main.textContent).toContain(`Request a refund · ${store}`);
    }
    const links = [...main.querySelectorAll('a')].map((node) => node.getAttribute('href'));
    expect(links).toEqual(expect.arrayContaining(['https://reportaproblem.apple.com', 'https://support.google.com/googleplay/answer/2479637']));
    expect(main.textContent).toContain('Billing continues');

    await press('Delete permanently now');
    expect(main.textContent).toContain('Paid time is forfeited');
    expect(main.textContent).toContain('Shown as "Deleted author"');
    expect(document.activeElement?.textContent).toBe('Delete permanently now');
    await press('Keep my account');
    expect(main.textContent).not.toContain('Paid time is forfeited');

    await press('Schedule deletion');
    expect(heading()).toBe('Your account is scheduled for deletion');
    expect(document.activeElement).toBe(main.querySelector('h1'));
    expect(main.textContent).toContain('Scheduled · deleted permanently on 15 Dec 2026');
  });

  it('asks again when the server needs Confirm it’s you, then runs the action', async () => {
    account.view = { state: 'signed-in', email: 'player@example.com', deletion: { status: 'scheduled', deadline: DEADLINE, scheduledAt: DEADLINE - 30 * DAY_MS } };
    await mountAccountPage(main, account);
    await press('Cancel deletion');
    expect(document.activeElement?.textContent).toBe("Confirm it's you");
    await press("Confirm it's you");
    await submit('Code', '123456');
    expect(heading()).toBe('Delete your account');
    expect(announced()).toBe('Deletion is canceled. Your account is open again.');
  });

  it('deletes permanently now, then shows processing apart from analytics, backups and the provider grant', async () => {
    account.fresh = true;
    account.view = { state: 'signed-in', email: 'player@example.com', deletion: { status: 'scheduled', deadline: DEADLINE, scheduledAt: DEADLINE - 30 * DAY_MS } };
    await mountAccountPage(main, account);
    await press('Delete permanently now');
    await press('Delete permanently now');
    expect(heading()).toBe('Your account was deleted');
    expect(main.textContent).toContain('Processing · finished by 22 Dec 2026');
    expect(main.textContent).toContain("Erasure requested · the analytics provider hasn't confirmed it yet");
    expect(main.textContent).toContain('Backups age out on their own schedule');
    expect(main.textContent).toContain('open your Apple ID or Google Account settings');

    account.view = { state: 'deleted', progress: progress('completed') };
    await press('Check again');
    expect(main.textContent).toContain('Completed on 16 Dec 2026');
    await press('Done');
    expect(heading()).toBe('Your Tableside account');
  });
});

describe('keyboard and screen-reader use', () => {
  it.each<[string, WebAccountView]>([
    ['signed out', { state: 'signed-out' }],
    ['signed in', { state: 'signed-in', email: 'player@example.com', deletion: { status: 'none' } }],
    ['scheduled', { state: 'signed-in', email: 'player@example.com', deletion: { status: 'scheduled', deadline: DEADLINE, scheduledAt: DEADLINE } }],
    ['status unknown', { state: 'signed-in', email: 'player@example.com', deletion: null }],
    ['deleted', { state: 'deleted', progress: null }],
  ])('%s: one heading, native controls in document order, every field labelled, billing help and support links', async (_, view) => {
    account.view = view;
    await mountAccountPage(main, account);
    expect(main.querySelectorAll('h1')).toHaveLength(1);
    // No positive tabindex, no click handlers on non-controls: Tab reaches every control in order and nothing traps it.
    for (const node of main.querySelectorAll('[tabindex]')) expect(Number(node.getAttribute('tabindex'))).toBeLessThanOrEqual(0);
    for (const node of main.querySelectorAll('button')) expect(node.getAttribute('type')).toMatch(/^(button|submit)$/);
    for (const input of main.querySelectorAll('input')) expect(main.querySelector(`label[for="${input.id}"]`)).not.toBeNull();
    for (const link of main.querySelectorAll('a[target="_blank"]')) expect(link.textContent).toContain('(opens in a new tab)');
    // Billing help stays visible whether or not anyone is signed in (Amendment 1 C2).
    for (const store of ['App Store', 'Google Play']) expect(main.textContent).toContain(`Request a refund · ${store}`);
    const help = main.querySelector('nav[aria-label="Help"]');
    expect(help?.textContent).toContain('Contact support');
    expect(help?.textContent).toContain('Make a privacy request');
    // Lifecycle only: nothing to play.
    expect(main.textContent).not.toMatch(/\b(Play now|Deal|Spin|Roll)\b/);
  });
});
