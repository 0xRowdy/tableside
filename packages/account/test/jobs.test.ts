// The stack's scheduled jobs (#84).

import { describe, expect, it } from 'vitest';

import { localStack, uniqueEmail } from '../src/testing';

const stack = localStack();

describe('the eligibility-assertion cleanup job', () => {
  it('is scheduled, and removes only assertions that can never pass again', async () => {
    const client = stack.rawClient();
    const issue = async () =>
      ((await client.rpc('issue_eligibility_assertion', { age_range: '18+' })).data as { assertion: string }).assertion;
    const [consumed, expired, fresh] = [await issue(), await issue(), await issue()];
    await client.auth.signInWithOtp({ email: uniqueEmail('job'), options: { data: { eligibility_assertion: consumed } } });
    await stack.expireAssertion(expired);

    const [job] = await stack.sql<{ command: string }[]>`select command from cron.job where jobname = 'expire-eligibility-assertions'`;
    expect(job).toBeDefined();
    await stack.sql.unsafe(job!.command);

    const remaining = await stack.sql<{ count: number }[]>`
      select count(*)::int as count from private.eligibility_assertions
      where token_hash in (extensions.digest(${consumed}, 'sha256'), extensions.digest(${expired}, 'sha256'), extensions.digest(${fresh}, 'sha256'))`;
    expect(remaining[0]?.count).toBe(1);
    const email = uniqueEmail('job-fresh');
    expect((await client.auth.signInWithOtp({ email, options: { data: { eligibility_assertion: fresh } } })).error).toBeNull();
    expect(await stack.authUserId(email)).not.toBeNull();
  });
});
