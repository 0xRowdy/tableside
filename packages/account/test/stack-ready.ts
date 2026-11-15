// Seam 2's global setup: waits, once per run, until the local stack is ready
// for scenarios rather than merely started. Right after `pnpm stack start`,
// Realtime accepts subscriptions before it delivers the database's broadcasts
// (realtime.send, which carries every "account changed" hint), and each edge
// function boots its worker on its first request; a scenario that met either
// failed or ran past its timeout on the first run after a fresh start.

import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { localStack } from '../src/testing';

const READY_WITHIN_MS = 120_000;
const functionsDir = fileURLToPath(new URL('../../../supabase/functions', import.meta.url));

export default async function stackReady(): Promise<void> {
  const stack = localStack();
  const deadline = Date.now() + READY_WITHIN_MS;
  try {
    await broadcastsDelivered(stack, deadline);
    // Each function's worker boots on its first request: a preflight is enough, whatever it answers.
    for (const name of readdirSync(functionsDir).filter((entry) => !entry.startsWith('_'))) {
      await fetch(`${stack.url}/functions/v1/${name}`, { method: 'OPTIONS' })
        .then((response) => response.arrayBuffer())
        .catch(() => undefined);
    }
  } finally {
    await stack.sql.end();
  }
}

/** Resolves once a broadcast sent from the database reaches a subscribed client. */
async function broadcastsDelivered(stack: ReturnType<typeof localStack>, deadline: number): Promise<void> {
  const client = stack.rawClient();
  const topic = `stack-ready-${process.pid}-${Date.now()}`;
  let delivered = false;
  const channel = client.channel(topic).on('broadcast', { event: 'ready' }, () => {
    delivered = true;
  });
  try {
    await new Promise<void>((resolve, reject) => {
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') resolve();
        else if (Date.now() > deadline) reject(new Error(`Realtime did not accept a subscription: ${status}`));
      });
    });
    while (!delivered) {
      if (Date.now() > deadline) throw new Error('Realtime did not deliver a database broadcast; is the stack healthy?');
      await stack.sql`select realtime.send('{}'::jsonb, 'ready', ${topic}, false)`;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  } finally {
    await client.removeChannel(channel);
    client.realtime.disconnect();
  }
}
