// Seam 2, email codes (#88): every code request sends an email, the answer is
// the same whether or not the address has an account, and the per-address and
// per-IP limits apply equally to both.

import { afterEach, describe, expect, it } from 'vitest';

import { type SimulatedDevice, createAccountByEmail, createDevice, localStack, uniqueEmail } from '../src/testing';

const stack = localStack();
const devices: SimulatedDevice[] = [];
function device(name: string): SimulatedDevice {
  const created = createDevice(stack, { name });
  devices.push(created);
  return created;
}
afterEach(() => devices.splice(0).forEach((d) => d.dispose()));

async function existingAccount(label: string): Promise<string> {
  const email = uniqueEmail(label);
  expect(await createAccountByEmail(device('setup'), email)).toEqual({ status: 'signed-in' });
  await stack.resetCodeRequests();
  return email;
}

/** The newest message to an address, waiting briefly for one to arrive. */
async function newestMessage(d: SimulatedDevice, email: string, count = 1): Promise<string> {
  for (let attempt = 0; attempt < 50; attempt++) {
    const messages = await d.mailbox.messages(email);
    if (messages.length >= count) return messages[0]!;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Fewer than ${count} messages arrived for ${email}.`);
}

describe('a sign-in code request', () => {
  it('emails the code when the address has an account', async () => {
    const email = await existingAccount('known');
    const phone = device('phone');
    const before = (await phone.mailbox.messages(email)).length;

    expect(await phone.account.requestEmailCode({ email, intent: 'sign-in' })).toEqual({ status: 'sent' });
    expect(await newestMessage(phone, email, before + 1)).toMatch(/Your Tableside code is \d{6}/);
  });

  it('emails "No account for this address" otherwise, creating nothing and logging only the type', async () => {
    const phone = device('phone');
    const email = uniqueEmail('unknown');
    const since = new Date();

    expect(await phone.account.requestEmailCode({ email, intent: 'sign-in' })).toEqual({ status: 'sent' });
    const message = await newestMessage(phone, email);
    expect(message).toMatch(/no Tableside account for it/);
    expect(message).toMatch(/Create account/);
    expect(message).not.toMatch(/\d{6}/);
    expect(await stack.authUserId(email)).toBeNull();
    expect(await stack.emailSends(since)).toContainEqual({ type: 'no-account', pacing: 'immediate', outcome: 'sent' });
  });

  it('answers the same either way, through the Account service and to a raw caller', async () => {
    const known = await existingAccount('same-known');
    const unknown = uniqueEmail('same-unknown');
    const phone = device('phone');

    expect(await phone.account.requestEmailCode({ email: unknown, intent: 'sign-in' })).toEqual(
      await phone.account.requestEmailCode({ email: known, intent: 'sign-in' }),
    );
    expect(await stack.requestCode({ email: unknown, intent: 'sign-in' })).toEqual(await stack.requestCode({ email: known, intent: 'sign-in' }));
  });

  it('reports a delivery failure at once, the same either way, with no retry', async () => {
    // The mail catcher refuses these recipients, as a provider refuses an undeliverable address.
    const known = await existingAccount('undeliverable');
    const undeliverableKnown = `"x"${known}`;
    await stack.sql`update auth.users set email = ${undeliverableKnown} where lower(email) = lower(${known})`;
    const undeliverableUnknown = `"x"${uniqueEmail('nobody')}`;
    const phone = device('phone');
    const since = new Date();

    const forKnown = await phone.account.requestEmailCode({ email: undeliverableKnown, intent: 'sign-in' });
    const forUnknown = await phone.account.requestEmailCode({ email: undeliverableUnknown, intent: 'sign-in' });
    expect(forKnown).toEqual({ status: 'failed' });
    expect(forUnknown).toEqual(forKnown);
    expect(await stack.emailSends(since)).toEqual([
      { type: 'code', pacing: 'immediate', outcome: 'failed' },
      { type: 'no-account', pacing: 'immediate', outcome: 'failed' },
    ]);
  });

  it('keeps no address, IP, code or body: only hashes for limits, and the type for sends', async () => {
    expect(await stack.columns('private.code_requests')).toEqual(['id', 'address_hash', 'ip_hash', 'requested_at']);
    expect(await stack.columns('private.email_sends')).toEqual(['id', 'type', 'pacing', 'outcome', 'sent_at']);
  });
});

describe('code-request limits', () => {
  it('backs off per address, the same for an address with an account and one without', async () => {
    const known = await existingAccount('backoff-known');
    const unknown = uniqueEmail('backoff-unknown');
    const phone = device('phone');

    for (const email of [known, unknown]) {
      const request = () => phone.account.requestEmailCode({ email, intent: 'sign-in' });
      expect(await request()).toEqual({ status: 'sent' });
      expect(await request()).toEqual({ status: 'sent' });
      expect(await request()).toEqual({ status: 'rate-limited', retryAfterSeconds: 30 });

      await stack.ageCodeRequests(email, 30);
      expect(await request()).toEqual({ status: 'sent' });
      expect(await request()).toMatchObject({ status: 'rate-limited', retryAfterSeconds: 60 });

      await stack.ageCodeRequests(email, 60);
      expect(await request()).toEqual({ status: 'sent' });
      expect(await request()).toMatchObject({ status: 'rate-limited', retryAfterSeconds: 120 });

      await stack.ageCodeRequests(email, 120);
      expect(await request()).toEqual({ status: 'sent' });
      // Five in the hour: the next waits for the oldest to leave the window.
      await stack.ageCodeRequests(email, 600);
      const capped = await request();
      expect(capped.status).toBe('rate-limited');
      if (capped.status !== 'rate-limited') throw new Error('unreachable');
      expect(capped.retryAfterSeconds).toBeGreaterThan(30 * 60);
    }
  });

  it('sends nothing for a refused request', async () => {
    const phone = device('phone');
    const email = uniqueEmail('refused');
    await phone.account.requestEmailCode({ email, intent: 'sign-in' });
    await phone.account.requestEmailCode({ email, intent: 'sign-in' });
    await newestMessage(phone, email, 2);
    expect(await phone.account.requestEmailCode({ email, intent: 'sign-in' })).toMatchObject({ status: 'rate-limited' });
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(await phone.mailbox.messages(email)).toHaveLength(2);
  });

  it('limits one network to 30 requests an hour across addresses', async () => {
    const phone = device('phone');
    for (let i = 0; i < 30; i++) {
      expect(await phone.account.requestEmailCode({ email: uniqueEmail(`ip-${i}`), intent: 'sign-in' })).toEqual({ status: 'sent' });
    }
    const refused = await phone.account.requestEmailCode({ email: uniqueEmail('ip-31'), intent: 'sign-in' });
    expect(refused.status).toBe('rate-limited');
  });

  it('applies to Create too, and a resend on Create reaches the same single account', async () => {
    const phone = device('phone');
    const email = uniqueEmail('create-resend');
    await phone.account.answerAgeQuestion('18+');
    expect(await phone.account.requestEmailCode({ email, intent: 'create' })).toEqual({ status: 'sent' });
    const first = await phone.mailbox.latestCode(email);
    expect(await phone.account.requestEmailCode({ email, intent: 'create' })).toEqual({ status: 'sent' });
    const second = await phone.mailbox.latestCode(email, { after: first });
    expect(await phone.account.requestEmailCode({ email, intent: 'create' })).toMatchObject({ status: 'rate-limited' });

    expect(await phone.account.verifyEmailCode({ email, code: second })).toEqual({ status: 'signed-in' });
    expect(await stack.accountCount(email)).toBe(1);
  });
});
