// Seam 2: reviewer access (#107; spec 2 *App-review access*, Amendment 1 C4,
// Amendment 8 §6). A privileged, per-environment operation makes designated
// synthetic reviewer accounts with an established adult eligibility record;
// each one's reviewer credential signs in to that account alone, with no email
// code, and the session it gets is an ordinary one.

import { afterEach, describe, expect, it } from 'vitest';

import { type SimulatedDevice, accessToken, createAccountByEmail, createDevice, localStack, signInByEmail, uniqueEmail } from '../src/testing';

const stack = localStack();
const devices: SimulatedDevice[] = [];
function device(name: string): SimulatedDevice {
  const created = createDevice(stack, { name });
  devices.push(created);
  return created;
}
afterEach(() => devices.splice(0).forEach((d) => d.dispose()));

const CREDENTIAL_FORMAT = /^[0-9A-HJKMNP-TV-Z]{5}(-[0-9A-HJKMNP-TV-Z]{5}){3}$/;

/** Provisions a reviewer account as an operator does, returning its address and credential. */
async function reviewerAccount(label = 'reviewer'): Promise<{ email: string; credential: string }> {
  const email = uniqueEmail(label);
  const { status, body } = await stack.provisionReviewer(email);
  expect(status).toBe(200);
  const credential = body?.credential;
  if (typeof credential !== 'string') throw new Error('no credential');
  return { email, credential };
}

async function ordinaryAccount(label = 'ordinary'): Promise<string> {
  const email = uniqueEmail(label);
  expect(await createAccountByEmail(device('setup'), email)).toEqual({ status: 'signed-in' });
  return email;
}

const sessionCount = async (email: string) => {
  const [row] = await stack.sql<{ count: number }[]>`
    select count(*)::int as count from auth.sessions s join auth.users u on u.id = s.user_id where lower(u.email) = lower(${email})`;
  return row!.count;
};

const isReviewerAccount = async (email: string) => {
  const [row] = await stack.sql<{ count: number }[]>`
    select count(*)::int as count from private.reviewer_accounts r join public.accounts a using (account_id)
    join auth.users u on u.id = a.auth_user_id where lower(u.email) = lower(${email})`;
  return row!.count === 1;
};

describe('provisioning reviewer accounts', () => {
  it('creates a confirmed account with an established adult eligibility record, keeping only the credential’s hash', async () => {
    const { email, credential } = await reviewerAccount();

    expect(credential).toMatch(CREDENTIAL_FORMAT);
    const accountId = await stack.accountId(email);
    expect(accountId).not.toBeNull();
    const [record] = await stack.sql`select band, source, policy_version from public.eligibility where account_id = ${accountId!}`;
    expect(record).toEqual({ band: '18+', source: 'declaration', policy_version: 1 });
    expect(await isReviewerAccount(email)).toBe(true);
    expect(await stack.columns('private.reviewer_accounts')).toEqual(['account_id', 'credential_hash', 'credential_issued_at']);
    const [kept] = await stack.sql<{ credential_hash: Buffer }[]>`select credential_hash from private.reviewer_accounts where account_id = ${accountId!}`;
    expect(kept!.credential_hash.toString('utf8')).not.toContain(credential.slice(0, 5));
    // Nobody had to answer an email.
    expect(await device('mail').mailbox.messages(email)).toEqual([]);
  });

  it('refuses any caller without the secret key, creating nothing', async () => {
    const signedIn = device('player');
    await createAccountByEmail(signedIn, uniqueEmail('player'));
    for (const key of [stack.publishableKey, accessToken(signedIn)]) {
      const email = uniqueEmail('not-privileged');
      expect(await stack.provisionReviewer(email, { key })).toEqual({ status: 403, body: { status: 'forbidden' } });
      expect(await stack.authUserId(email)).toBeNull();
    }
  });

  it('refuses a request naming another environment, or none, creating nothing', async () => {
    for (const environment of ['beta', null] as const) {
      const email = uniqueEmail('wrong-environment');
      expect(await stack.provisionReviewer(email, { environment })).toEqual({ status: 403, body: { status: 'forbidden' } });
      expect(await stack.authUserId(email)).toBeNull();
    }
  });

  it('never designates an existing account or a Create under way', async () => {
    const ordinary = await ordinaryAccount();
    const pending = uniqueEmail('pending');
    const creating = device('creating');
    expect((await creating.account.answerAgeQuestion('18+')).status).toBe('eligible');
    expect(await creating.account.requestEmailCode({ email: pending, intent: 'create' })).toEqual({ status: 'sent' });

    for (const email of [ordinary, pending]) {
      expect(await stack.provisionReviewer(email)).toEqual({ status: 409, body: { status: 'not-designated' } });
      expect(await isReviewerAccount(email)).toBe(false);
    }
    // The Create finishes as an ordinary account.
    expect(await creating.account.verifyEmailCode({ email: pending, code: await creating.mailbox.latestCode(pending) })).toEqual({ status: 'signed-in' });
    expect(await isReviewerAccount(pending)).toBe(false);
  });

  it('makes one reviewer account when two calls for a new address race', async () => {
    const email = uniqueEmail('racing');
    const answers = await Promise.all([stack.provisionReviewer(email), stack.provisionReviewer(email)]);

    expect(answers.map((answer) => answer.status)).toEqual([200, 200]);
    expect(await stack.accountCount(email)).toBe(1);
    expect(await isReviewerAccount(email)).toBe(true);
    // Whichever credential was issued last is the account's one.
    const results = await Promise.all(answers.map((answer) => device('phone').account.signInAsReviewer({ email, credential: answer.body!.credential! })));
    expect(results.filter((result) => result.status === 'signed-in')).toHaveLength(1);
  });

  it('reissuing a credential replaces the last one', async () => {
    const { email, credential: first } = await reviewerAccount();
    const { status, body } = await stack.provisionReviewer(email);
    expect(status).toBe(200);
    const second = body!.credential!;
    expect(second).not.toBe(first);
    expect(await stack.accountCount(email)).toBe(1);

    expect(await device('phone').account.signInAsReviewer({ email, credential: first })).toEqual({ status: 'refused' });
    expect(await device('tablet').account.signInAsReviewer({ email, credential: second })).toEqual({ status: 'signed-in' });
  });
});

describe('signing in with a reviewer credential', () => {
  it('signs in to the reviewer account on any device, with no email code', async () => {
    const { email, credential } = await reviewerAccount();
    const accountId = await stack.accountId(email);
    const reviewers = [device('iphone'), device('ipad'), device('android')];

    // All at once, as a review team may test on several devices together.
    expect(await Promise.all(reviewers.map((d) => d.account.signInAsReviewer({ email, credential })))).toEqual(
      reviewers.map(() => ({ status: 'signed-in' })),
    );
    for (const d of reviewers) expect(d.account.gate).toEqual({ state: 'active', accountId, eligibility: '18+' });
    expect(await reviewers[0]!.mailbox.messages(email)).toEqual([]);
  });

  it('reads the credential however the reviewer types it: case, spaces and dashes, O for 0 and I or L for 1', async () => {
    const { email, credential } = await reviewerAccount();
    const typed = credential.replaceAll('-', ' ').toLowerCase().replaceAll('0', 'o').replaceAll('1', 'l');

    expect(await device('phone').account.signInAsReviewer({ email: ` ${email.toUpperCase()} `, credential: typed })).toEqual({ status: 'signed-in' });
  });

  it('is refused for every account but the one it was issued to, the same way each time', async () => {
    const reviewer = await reviewerAccount();
    const other = await reviewerAccount('other-reviewer');
    const ordinary = await ordinaryAccount();
    const pending = uniqueEmail('pending');
    const creating = device('creating');
    await creating.account.answerAgeQuestion('18+');
    expect(await creating.account.requestEmailCode({ email: pending, intent: 'create' })).toEqual({ status: 'sent' });
    const before = { ordinary: await sessionCount(ordinary), other: await sessionCount(other.email) };

    const attempts = [
      { email: ordinary, credential: reviewer.credential },
      { email: other.email, credential: reviewer.credential },
      { email: pending, credential: reviewer.credential },
      { email: uniqueEmail('nobody'), credential: reviewer.credential },
      { email: reviewer.email, credential: other.credential },
      { email: reviewer.email, credential: '' },
      { email: reviewer.email, credential: 'AAAAA-AAAAA-AAAAA-AAAAA' },
    ];
    for (const attempt of attempts) {
      const phone = device('phone');
      expect(await phone.account.signInAsReviewer(attempt)).toEqual({ status: 'refused' });
      expect(phone.account.gate).toEqual({ state: 'no-account' });
      expect(await stack.reviewerSignIn(attempt)).toEqual({ status: 401, body: { status: 'refused' } });
    }
    expect(await sessionCount(ordinary)).toBe(before.ordinary);
    expect(await sessionCount(other.email)).toBe(before.other);
    expect(await sessionCount(pending)).toBe(0);
  });

  it('is refused once the reviewer account is deleted', async () => {
    const { email, credential } = await reviewerAccount();
    await stack.sql`update public.accounts set state = 'deleted' where account_id = ${(await stack.accountId(email))!}`;

    expect(await device('phone').account.signInAsReviewer({ email, credential })).toEqual({ status: 'refused' });
  });

  it('works only in the environment that issued it', async () => {
    const { email, credential } = await reviewerAccount();

    // The same server serving as another environment's project: the account, and so its credential, isn't that environment's.
    expect(await stack.asEnvironment('beta', () => stack.reviewerSignIn({ email, credential }, 'beta'))).toEqual({ status: 401, body: { status: 'refused' } });
    // A request naming another environment, or none, is refused before the credential is looked at.
    for (const environment of ['beta', null] as const) {
      expect((await stack.reviewerSignIn({ email, credential }, environment)).status).toBe(502);
    }
    expect(await sessionCount(email)).toBe(0);
  });
});

describe('a reviewer account', () => {
  it('gets an ordinary session, with no elevated permission', async () => {
    const { email, credential } = await reviewerAccount();
    const ordinary = await ordinaryAccount();
    const phone = device('phone');
    expect(await phone.account.signInAsReviewer({ email, credential })).toEqual({ status: 'signed-in' });
    const raw = stack.rawClient(accessToken(phone));

    // Nothing privileged: not the reviewer operations, not the code-request functions.
    expect((await raw.rpc('issue_reviewer_credential', { address: email })).error).not.toBeNull();
    expect((await raw.rpc('reviewer_credential_valid', { address: email, credential })).error).not.toBeNull();
    expect((await raw.rpc('email_code_recipient', { address: ordinary })).error).not.toBeNull();
    // Only its own rows.
    const { data: accounts } = await raw.from('accounts').select('account_id');
    expect(accounts).toEqual([{ account_id: await stack.accountId(email) }]);
    expect(await stack.provisionReviewer(uniqueEmail('escalate'), { key: accessToken(phone) })).toEqual({ status: 403, body: { status: 'forbidden' } });
  });

  it('passes the same eligibility protections as any account', async () => {
    const { email, credential } = await reviewerAccount();
    const accountId = await stack.accountId(email);
    // A platform answer replaces the provisioned declaration, as for any account.
    const phone = device('phone');
    phone.ageSignals.signal = { kind: 'range', range: '16-17' };
    expect(await phone.account.signInAsReviewer({ email, credential })).toEqual({ status: 'signed-in' });
    expect(phone.account.gate).toEqual({ state: 'active', accountId, eligibility: '16-17' });
    const [record] = await stack.sql`select band, source from public.eligibility where account_id = ${accountId!}`;
    expect(record).toEqual({ band: '16-17', source: 'platform-signal' });

    // Under 13 on record (support review): only the restricted paths, as for any account.
    await stack.sql`update public.eligibility set band = 'under-13' where account_id = ${accountId!}`;
    const tablet = device('tablet');
    expect(await tablet.account.signInAsReviewer({ email, credential })).toEqual({ status: 'signed-in' });
    expect(tablet.account.gate).toEqual({ state: 'age-ineligible', accountId });
    const { data: accounts } = await stack.rawClient(accessToken(tablet)).from('accounts').select('account_id');
    expect(accounts).toEqual([]);
  });

  it('is locked out by the authorization gate like any account once its session ends', async () => {
    const { email, credential } = await reviewerAccount();
    const phone = device('phone');
    expect(await phone.account.signInAsReviewer({ email, credential })).toEqual({ status: 'signed-in' });
    const token = accessToken(phone);

    expect(await phone.account.signOut()).toEqual({ status: 'signed-out', serverSessionEnded: true });
    const { data } = await stack.rawClient(token).rpc('current_account');
    expect(data).toBeNull();
  });

  it('can still sign in by email code, like any account', async () => {
    const { email } = await reviewerAccount();
    expect(await signInByEmail(device('phone'), email)).toEqual({ status: 'signed-in' });
  });
});
