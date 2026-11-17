// Spec 2 Amendment 1 C5; #92

import { describe, expect, it } from 'vitest';

import { PROTOCOL_VERSION, SYNC_OPERATIONS, completedPracticeSession } from '../src';
import { prepareOperation } from '../src/sync/protocol';
import { type SimulatedDevice, createAccountByEmail, createDevice, directCommands, localStack, uniqueEmail } from '../src/testing';

const { sql } = localStack();

describe('the release check: server and client agree', () => {
  it('serves this build’s protocol, with no retirement already passed', async () => {
    const [row] = await sql<{ served: boolean }[]>`select private.protocol_served(${PROTOCOL_VERSION}) as served`;
    expect(row?.served).toBe(true);
    expect((await localStack().rawClient().rpc('sync_protocol', { protocol: PROTOCOL_VERSION })).data).toMatchObject({
      status: expect.stringMatching(/^(supported|retiring)$/),
    });
  });

  it('has every operation this build calls, each callable by a signed-in session and versioned to this build’s protocol unless it is sync_protocol', async () => {
    for (const name of Object.values(SYNC_OPERATIONS)) {
      const [row] = await sql<{ callable: boolean }[]>`
        select has_function_privilege('authenticated', p.oid, 'execute') as callable
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = ${name}`;
      expect(row?.callable, name).toBe(true);
      if (name !== SYNC_OPERATIONS.protocol) expect(name, name).toMatch(new RegExp(`_v${PROTOCOL_VERSION}$`));
    }
  });

  it('knows the protocol of every versioned operation it exposes', async () => {
    const rows = await sql<{ name: string; version: number; known: boolean }[]>`
      select p.proname as name, substring(p.proname from '_v([0-9]+)$')::integer as version,
        exists (select 1 from private.sync_protocols s where s.protocol = substring(p.proname from '_v([0-9]+)$')::integer) as known
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname ~ '_v[0-9]+$'`;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.filter((row) => !row.known)).toEqual([]);
  });

  it('hashes this build’s encoding of a request exactly as the build does', async () => {
    const d: SimulatedDevice = createDevice(localStack(), { name: 'release-check' });
    try {
      expect(await createAccountByEmail(d, uniqueEmail('release'))).toEqual({ status: 'signed-in' });
      const gate = d.account.gate;
      if (gate.state !== 'active') throw new Error('unreachable');
      await d.account.sync.idle();
      const installation = d.vault.store().identity.installationId;
      const token = [...d.credentials.items.values()].map((value) => {
        try {
          return (JSON.parse(value) as { access_token?: string }).access_token;
        } catch {
          return undefined;
        }
      }).find((value) => typeof value === 'string');
      const raw = localStack().rawClient(token);
      const prepared = prepareOperation({
        protocol: PROTOCOL_VERSION,
        operation: 'c'.repeat(32),
        installation,
        command: (await directCommands(raw, installation)).next(),
        recordType: completedPracticeSession.name,
        payloadVersion: completedPracticeSession.payloadVersion,
        item: 'release-check-1',
        payload: {
          recordVersion: 1,
          activityId: 'release-check-1',
          owner: gate.accountId,
          device: installation,
          game: 'roulette',
          mode: 'free-play',
          startedAt: 1,
          endedAt: 2,
          buyIn: '1000',
          cumulativeFunding: '1000',
          finalCashOut: '1010',
          netResult: '10',
          turnsPlayed: 1,
          note: 'Café ♠',
        },
      });
      const { data } = await raw.rpc(SYNC_OPERATIONS.upload, { request: prepared.request });
      expect(data).toMatchObject({ status: 'accepted', operation: prepared.operationId, requestHash: prepared.requestHash });
    } finally {
      d.dispose();
    }
  });
});
