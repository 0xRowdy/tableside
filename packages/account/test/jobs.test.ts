// #84

import { describe, expect, it } from 'vitest';

import { localStack, uniqueEmail } from '../src/testing';

const stack = localStack();

describe('the eligibility-assertion cleanup job', () => {
  it('is scheduled, and removes only assertions that can never pass again', async () => {
    const client = stack.rawClient();
    const issue = async () =>
      ((await client.rpc('issue_eligibility_assertion', { age_range: '18+' })).data as { assertion: string }).assertion;
    const [consumed, expired, fresh] = [await issue(), await issue(), await issue()];
    await stack.requestCode({ email: uniqueEmail('job'), intent: 'create', assertion: consumed });
    await stack.expireAssertion(expired);

    const [job] = await stack.sql<{ command: string }[]>`select command from cron.job where jobname = 'expire-eligibility-assertions'`;
    expect(job).toBeDefined();
    await stack.sql.unsafe(job!.command);

    const remaining = await stack.sql<{ count: number }[]>`
      select count(*)::int as count from private.eligibility_assertions
      where token_hash in (extensions.digest(${consumed}, 'sha256'), extensions.digest(${expired}, 'sha256'), extensions.digest(${fresh}, 'sha256'))`;
    expect(remaining[0]?.count).toBe(1);
    const email = uniqueEmail('job-fresh');
    expect(await stack.requestCode({ email, intent: 'create', assertion: fresh })).toEqual({ status: 200, body: { status: 'sent' } });
    expect(await stack.authUserId(email)).not.toBeNull();
  });
});

describe('the email-records cleanup job', () => {
  it('is scheduled, and removes code requests older than an hour and send-log entries older than 30 days', async () => {
    const recent = uniqueEmail('records-recent');
    const old = uniqueEmail('records-old');
    for (const email of [recent, old]) await stack.requestCode({ email, intent: 'sign-in' });
    await stack.ageCodeRequests(old, 3601);
    const [inserted] = await stack.sql<{ id: number }[]>`
      insert into private.email_sends (type, pacing, outcome, sent_at) values ('code', 'immediate', 'sent', now() - interval '31 days') returning id`;

    const [job] = await stack.sql<{ command: string }[]>`select command from cron.job where jobname = 'expire-email-records'`;
    expect(job).toBeDefined();
    await stack.sql.unsafe(job!.command);

    const requests = await stack.sql<{ address_hash: Buffer }[]>`
      select address_hash from private.code_requests
      where address_hash in (extensions.digest(lower(${recent}), 'sha256'), extensions.digest(lower(${old}), 'sha256'))`;
    expect(requests).toHaveLength(1);
    expect(await stack.sql`select 1 from private.email_sends where id = ${inserted!.id}`).toHaveLength(0);
    expect((await stack.sql<{ count: number }[]>`select count(*)::int as count from private.email_sends where sent_at > now() - interval '1 minute'`)[0]!.count).toBeGreaterThan(0);
  });
});
